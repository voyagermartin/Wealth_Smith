/**
 * Wealth_Smith GAS - XIRR Calculation Engine
 * Implements Newton-Raphson & Bisection XIRR algorithms for non-periodic cash flows.
 */

/**
 * Core XIRR mathematical calculation using Newton-Raphson method with Bisection fallback.
 * @param {Array<Date>} dates Array of JavaScript Date objects
 * @param {Array<number>} values Array of cash flows (negative for outflows, positive for inflows)
 * @param {number} [guess=0.1] Initial guess rate (default 10%)
 * @returns {number} Annualized Internal Rate of Return (XIRR) as decimal (e.g. 0.15 = 15%)
 */
function xirr(dates, values, guess) {
  if (!dates || !values || dates.length !== values.length || dates.length < 2) {
    return 0;
  }
  
  var r = (guess !== undefined && !isNaN(guess)) ? guess : 0.1;
  var maxIter = 100;
  var tol = 1e-6;
  
  var t0 = dates[0].getTime();
  var dayDiffs = [];
  for (var i = 0; i < dates.length; i++) {
    dayDiffs.push((dates[i].getTime() - t0) / (1000 * 60 * 60 * 24 * 365.0));
  }
  
  // Newton-Raphson Iteration
  for (var iter = 0; iter < maxIter; iter++) {
    var npv = 0;
    var dnpv = 0;
    
    for (var i = 0; i < values.length; i++) {
      var dt = dayDiffs[i];
      var factor = Math.pow(1 + r, dt);
      if (isNaN(factor) || !isFinite(factor) || factor === 0) break;
      
      npv += values[i] / factor;
      dnpv -= dt * values[i] / (factor * (1 + r));
    }
    
    if (Math.abs(npv) < tol) {
      return r;
    }
    
    if (dnpv === 0 || isNaN(dnpv) || !isFinite(dnpv)) {
      break;
    }
    
    var nextR = r - npv / dnpv;
    if (nextR <= -0.999) {
      nextR = (r - 0.999) / 2; // Keep rate above -100%
    }
    
    if (Math.abs(nextR - r) < tol) {
      return nextR;
    }
    
    r = nextR;
  }
  
  // Fallback: Bisection Method if Newton-Raphson fails to converge
  return bisectionXIRR(dayDiffs, values, -0.99, 10.0, tol);
}

/**
 * Bisection method fallback for XIRR calculation.
 */
function bisectionXIRR(dayDiffs, values, low, high, tol) {
  var npvLow = calcNPV(dayDiffs, values, low);
  var npvHigh = calcNPV(dayDiffs, values, high);
  
  if (npvLow * npvHigh > 0) {
    return 0; // Unable to bracket root
  }
  
  for (var i = 0; i < 100; i++) {
    var mid = (low + high) / 2;
    var npvMid = calcNPV(dayDiffs, values, mid);
    
    if (Math.abs(npvMid) < tol || (high - low) / 2 < tol) {
      return mid;
    }
    
    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }
  
  return (low + high) / 2;
}

/**
 * Helper to calculate NPV for given rate r and precalculated dayDiffs.
 */
function calcNPV(dayDiffs, values, r) {
  var npv = 0;
  for (var i = 0; i < values.length; i++) {
    npv += values[i] / Math.pow(1 + r, dayDiffs[i]);
  }
  return npv;
}

/**
 * Calculate XIRR for a specific stock ticker.
 */
function calculateStockXIRR(ss, ticker, currentPrice, currentShares) {
  if (!ticker) return 0;
  
  var cashFlows = [];
  
  // 1. Transactions Sheet
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    var txData = txSheet.getDataRange().getValues();
    for (var i = 1; i < txData.length; i++) {
      var row = txData[i];
      var rowDate = row[0];
      var rowTicker = row[1];
      var rowNetCF = row[8]; // Column I (NetCashFlow)
      
      if (rowTicker && rowTicker.toString().trim() === ticker && rowDate instanceof Date) {
        var cf = parseFloat(rowNetCF);
        if (isNaN(cf)) {
          var type = row[3];
          var price = parseFloat(row[4]) || 0;
          var shares = parseFloat(row[5]) || 0;
          var fee = parseFloat(row[7]) || 0;
          cf = (type === '買入') ? -(price * shares + fee) : +(price * shares - fee);
        }
        if (cf !== 0) {
          cashFlows.push({ date: new Date(rowDate), value: cf });
        }
      }
    }
  }
  
  // 2. Dividends Sheet
  var divSheet = ss.getSheetByName('Dividends');
  if (divSheet) {
    var divData = divSheet.getDataRange().getValues();
    for (var i = 1; i < divData.length; i++) {
      var row = divData[i];
      var payDate = row[1] || row[0]; // PayDate or ExDate
      var rowTicker = row[2];
      var rowNetCF = row[6]; // Column G (NetCashFlow)
      
      if (rowTicker && rowTicker.toString().trim() === ticker && payDate instanceof Date) {
        var cf = parseFloat(rowNetCF);
        if (isNaN(cf)) {
          var dps = parseFloat(row[3]) || 0;
          var shares = parseFloat(row[4]) || 0;
          cf = dps * shares;
        }
        if (cf > 0) {
          cashFlows.push({ date: new Date(payDate), value: cf });
        }
      }
    }
  }
  
  // 3. Terminal Value (Today)
  if (currentShares > 0 && currentPrice > 0) {
    cashFlows.push({ date: new Date(), value: currentShares * currentPrice });
  }
  
  if (cashFlows.length < 2) return 0;
  
  // Sort cash flows by date ascending
  cashFlows.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  
  var dates = cashFlows.map(function(item) { return item.date; });
  var values = cashFlows.map(function(item) { return item.value; });
  
  return xirr(dates, values);
}

/**
 * Calculate overall portfolio XIRR.
 */
function calculatePortfolioXIRR(ss) {
  var cashFlows = [];
  
  // 1. Transactions Sheet (All tickers)
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    var txData = txSheet.getDataRange().getValues();
    for (var i = 1; i < txData.length; i++) {
      var row = txData[i];
      var rowDate = row[0];
      var rowNetCF = row[8];
      
      if (rowDate instanceof Date) {
        var cf = parseFloat(rowNetCF);
        if (isNaN(cf)) {
          var type = row[3];
          var price = parseFloat(row[4]) || 0;
          var shares = parseFloat(row[5]) || 0;
          var fee = parseFloat(row[7]) || 0;
          cf = (type === '買入') ? -(price * shares + fee) : +(price * shares - fee);
        }
        if (cf !== 0) {
          cashFlows.push({ date: new Date(rowDate), value: cf });
        }
      }
    }
  }
  
  // 2. Dividends Sheet (All tickers)
  var divSheet = ss.getSheetByName('Dividends');
  if (divSheet) {
    var divData = divSheet.getDataRange().getValues();
    for (var i = 1; i < divData.length; i++) {
      var row = divData[i];
      var payDate = row[1] || row[0];
      var rowNetCF = row[6];
      
      if (payDate instanceof Date) {
        var cf = parseFloat(rowNetCF);
        if (isNaN(cf)) {
          var dps = parseFloat(row[3]) || 0;
          var shares = parseFloat(row[4]) || 0;
          cf = dps * shares;
        }
        if (cf > 0) {
          cashFlows.push({ date: new Date(payDate), value: cf });
        }
      }
    }
  }
  
  // 3. Total Portfolio Terminal Value
  var dashSheet = ss.getSheetByName('Dashboard');
  var totalMarketValue = 0;
  if (dashSheet) {
    var totalValCell = dashSheet.getRange('B4').getValue(); // B4 is Total Current Market Value
    totalMarketValue = parseFloat(totalValCell) || 0;
  }
  
  if (totalMarketValue > 0) {
    cashFlows.push({ date: new Date(), value: totalMarketValue });
  }
  
  if (cashFlows.length < 2) return 0;
  
  cashFlows.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  
  var dates = cashFlows.map(function(item) { return item.date; });
  var values = cashFlows.map(function(item) { return item.value; });
  
  return xirr(dates, values);
}

/**
 * Main batch runner: Updates all XIRR values in the Dashboard tab.
 */
function updateAllXIRR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = ss.getSheetByName('Dashboard');
  if (!dashSheet) return;
  
  // 1. Update Per-Stock XIRR (Row 10 to last row)
  var lastRow = dashSheet.getLastRow();
  if (lastRow >= 10) {
    var stockData = dashSheet.getRange(10, 1, lastRow - 9, 10).getValues();
    for (var idx = 0; idx < stockData.length; idx++) {
      var rowNum = 10 + idx;
      var ticker = stockData[idx][0];
      var cumShares = parseFloat(stockData[idx][3]) || 0;
      var price = parseFloat(stockData[idx][5]);
      
      // If GOOGLEFINANCE price cell is loading, NaN, 0, or anomalous (e.g. > 200 for 0056), fallback to PriceFetcher
      if (isNaN(price) || price === 0 || isPriceAnomalous(ticker, price)) {
        var fetchedPrice = getCurrentPrice(ticker);
        if (fetchedPrice > 0 && !isPriceAnomalous(ticker, fetchedPrice)) {
          price = fetchedPrice;
          dashSheet.getRange(rowNum, 6).setValue(price);
        }
      }
      
      if (ticker) {
        var stockXirr = calculateStockXIRR(ss, ticker, price, cumShares);
        dashSheet.getRange(rowNum, 10).setValue(stockXirr).setNumberFormat('0.00%').setFontWeight('bold');
      }
    }
  }
  
  // 2. Update Overall Portfolio XIRR (Cell B7)
  var portfolioXirr = calculatePortfolioXIRR(ss);
  dashSheet.getRange('B7').setValue(portfolioXirr).setNumberFormat('0.00%').setFontWeight('bold');
  
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ XIRR 計算與儀表板已更新完成！', 'Wealth_Smith');
}
