/**
 * Wealth_Smith GAS - System Main Entry, Custom Menu, Price Fetcher & XIRR Engine
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Wealth_Smith 儀表板')
    .addItem('⚡ 初始化 / 重置工作表 (Setup Sheets)', 'setupAllSheets')
    .addItem('🔄 立即更新所有 XIRR 與儀表板', 'updateDashboard')
    .addSeparator()
    .addItem('⏰ 設定每日收盤自動更新 (14:30 Trigger)', 'setupDailyTrigger')
    .addToUi();
}

/**
 * Main update function to refresh current prices, total market value, and XIRR.
 */
function updateDashboard() {
  updateAllXIRR();
}

/**
 * Sets up a daily time-driven trigger to run updateAllXIRR at 14:30 Taipei time.
 */
function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateAllXIRR') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger('updateAllXIRR')
    .timeBased()
    .atHour(14)
    .nearMinute(30)
    .everyDays(1)
    .inTimezone('Asia/Taipei')
    .create();
    
  SpreadsheetApp.getUi().alert('⏰ 已成功設定每日 14:30 股市收盤自動更新排程！');
}

/**
 * Custom Function for Google Sheets formula backup price fetching.
 * Formula usage: =PriceFetcher_Backup("0056.TW")
 * @customfunction
 * @param {string} ticker Stock ticker (e.g. "0056.TW", "2330.TW")
 * @returns {number|string} Current price or empty string if failed
 */
function PriceFetcher_Backup(ticker) {
  if (!ticker) return "";
  var price = getCurrentPrice(ticker);
  return price > 0 ? price : "";
}

/**
 * Check if fetched price is anomalous or unreasonable.
 */
function isPriceAnomalous(ticker, price) {
  if (price === null || price === undefined || isNaN(price) || price <= 0) {
    return true;
  }
  if (!ticker) return false;
  
  var cleanTicker = ticker.toString().trim().toUpperCase();
  if (cleanTicker.indexOf('0056') !== -1) {
    if (price < 10 || price > 200) {
      return true;
    }
  }
  if (cleanTicker.endsWith('.TW') || cleanTicker.endsWith('.TWO') || /^\d{4}$/.test(cleanTicker)) {
    if (price > 5000) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch current price for a ticker with TWSE / Yahoo Finance fallbacks and sanity checks.
 */
function getCurrentPrice(ticker) {
  if (!ticker) return 0;
  
  ticker = ticker.toString().trim();
  var cleanSymbol = ticker.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  
  if (ticker.toUpperCase().endsWith('.TW') || ticker.toUpperCase().endsWith('.TWO') || /^\d{4}$/.test(cleanSymbol)) {
    try {
      var prefixes = ['tse', 'otc'];
      for (var p = 0; p < prefixes.length; p++) {
        var twseUrl = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=' + prefixes[p] + '_' + cleanSymbol.toLowerCase() + '.tw';
        var twseResp = UrlFetchApp.fetch(twseUrl, { muteHttpExceptions: true });
        if (twseResp.getResponseCode() === 200) {
          var twseJson = JSON.parse(twseResp.getContentText());
          if (twseJson.msgArray && twseJson.msgArray.length > 0) {
            var item = twseJson.msgArray[0];
            var z = parseFloat(item.z);
            if (!isNaN(z) && !isPriceAnomalous(ticker, z)) {
              return z;
            }
            var y = parseFloat(item.y);
            if (!isNaN(y) && !isPriceAnomalous(ticker, y)) {
              return y;
            }
          }
        }
      }
    } catch (e) {
      Logger.log('TWSE API error for ' + ticker + ': ' + e.message);
    }
  }
  
  try {
    var yahooTicker = ticker;
    if (/^\d{4}$/.test(ticker)) yahooTicker = ticker + '.TW';
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooTicker);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var json = JSON.parse(response.getContentText());
      if (json.chart && json.chart.result && json.chart.result.length > 0) {
        var meta = json.chart.result[0].meta;
        var price = parseFloat(meta.regularMarketPrice);
        if (!isNaN(price) && !isPriceAnomalous(ticker, price)) {
          return price;
        }
        var prevClose = parseFloat(meta.previousClose);
        if (!isNaN(prevClose) && !isPriceAnomalous(ticker, prevClose)) {
          return prevClose;
        }
      }
    }
  } catch (e) {
    Logger.log('Yahoo Finance API error for ' + ticker + ': ' + e.message);
  }
  
  return 0;
}

/**
 * Custom Function for Google Sheets formula to calculate XIRR for a specific stock.
 * Formula usage: =STOCK_XIRR(A10)
 * @customfunction
 */
function STOCK_XIRR(ticker) {
  if (!ticker) return "";
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dashSheet = ss.getSheetByName('Dashboard');
    var currentPrice = 0;
    var currentShares = 0;
    
    if (dashSheet) {
      var data = dashSheet.getDataRange().getValues();
      for (var r = 9; r < data.length; r++) {
        if (data[r][0] && data[r][0].toString().trim() === ticker) {
          currentShares = parseFloat(data[r][3]) || 0;
          currentPrice = parseFloat(data[r][5]) || 0;
          break;
        }
      }
    }
    
    if (currentPrice <= 0 || isPriceAnomalous(ticker, currentPrice)) {
      currentPrice = getCurrentPrice(ticker);
    }
    
    var rate = calculateStockXIRR(ss, ticker.toString().trim(), currentPrice, currentShares);
    return rate;
  } catch (e) {
    return 0;
  }
}

/**
 * Custom Function for Google Sheets formula to calculate overall portfolio XIRR.
 * Formula usage: =PORTFOLIO_XIRR()
 * @customfunction
 */
function PORTFOLIO_XIRR() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rate = calculatePortfolioXIRR(ss);
    return rate;
  } catch (e) {
    return 0;
  }
}

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
    if (Math.abs(npv) < tol) return r;
    if (dnpv === 0 || isNaN(dnpv) || !isFinite(dnpv)) break;
    var nextR = r - npv / dnpv;
    if (nextR <= -0.999) nextR = (r - 0.999) / 2;
    if (Math.abs(nextR - r) < tol) return nextR;
    r = nextR;
  }
  return bisectionXIRR(dayDiffs, values, -0.99, 10.0, tol);
}

function bisectionXIRR(dayDiffs, values, low, high, tol) {
  var npvLow = calcNPV(dayDiffs, values, low);
  var npvHigh = calcNPV(dayDiffs, values, high);
  if (npvLow * npvHigh > 0) return 0;
  for (var i = 0; i < 100; i++) {
    var mid = (low + high) / 2;
    var npvMid = calcNPV(dayDiffs, values, mid);
    if (Math.abs(npvMid) < tol || (high - low) / 2 < tol) return mid;
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

function calcNPV(dayDiffs, values, r) {
  var npv = 0;
  for (var i = 0; i < values.length; i++) {
    npv += values[i] / Math.pow(1 + r, dayDiffs[i]);
  }
  return npv;
}

function calculateStockXIRR(ss, ticker, currentPrice, currentShares) {
  if (!ticker) return 0;
  var cashFlows = [];
  var txSheet = ss.getSheetByName('Transactions');
  if (txSheet) {
    var txData = txSheet.getDataRange().getValues();
    for (var i = 1; i < txData.length; i++) {
      var row = txData[i];
      var rowDate = row[0];
      var rowTicker = row[1];
      var rowNetCF = row[8];
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
  var divSheet = ss.getSheetByName('Dividends');
  if (divSheet) {
    var divData = divSheet.getDataRange().getValues();
    for (var i = 1; i < divData.length; i++) {
      var row = divData[i];
      var payDate = row[1] || row[0];
      var rowTicker = row[2];
      var rowNetCF = row[6];
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
  if (currentShares > 0 && currentPrice > 0) {
    cashFlows.push({ date: new Date(), value: currentShares * currentPrice });
  }
  if (cashFlows.length < 2) return 0;
  cashFlows.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });
  var dates = cashFlows.map(function(item) { return item.date; });
  var values = cashFlows.map(function(item) { return item.value; });
  return xirr(dates, values);
}

function calculatePortfolioXIRR(ss) {
  var cashFlows = [];
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
  var dashSheet = ss.getSheetByName('Dashboard');
  var totalMarketValue = 0;
  if (dashSheet) {
    var totalValCell = dashSheet.getRange('B4').getValue();
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

function updateAllXIRR() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = ss.getSheetByName('Dashboard');
  if (!dashSheet) return;
  
  var lastRow = dashSheet.getLastRow();
  if (lastRow >= 10) {
    var stockData = dashSheet.getRange(10, 1, lastRow - 9, 10).getValues();
    for (var idx = 0; idx < stockData.length; idx++) {
      var rowNum = 10 + idx;
      var ticker = stockData[idx][0];
      var cumShares = parseFloat(stockData[idx][3]) || 0;
      var price = parseFloat(stockData[idx][5]);
      
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
  var portfolioXirr = calculatePortfolioXIRR(ss);
  dashSheet.getRange('B7').setValue(portfolioXirr).setNumberFormat('0.00%').setFontWeight('bold');
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ XIRR 計算與儀表板已更新完成！', 'Wealth_Smith');
}
