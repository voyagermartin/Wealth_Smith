/**
 * Wealth_Smith GAS - Price Fetcher Module
 * Handles stock price fetching with fallback mechanisms and sanity checks.
 */

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
 * @param {string} ticker Stock ticker
 * @param {number} price Fetched price
 * @returns {boolean} True if price is anomalous
 */
function isPriceAnomalous(ticker, price) {
  if (price === null || price === undefined || isNaN(price) || price <= 0) {
    return true;
  }
  if (!ticker) return false;
  
  var cleanTicker = ticker.toString().trim().toUpperCase();
  
  // Specific sanity check for 0056 ETF (price typically around 20~60 TWD)
  if (cleanTicker.indexOf('0056') !== -1) {
    if (price < 10 || price > 200) {
      return true;
    }
  }
  
  // General Taiwan stock sanity check (price > 5000 TWD is anomalous)
  if (cleanTicker.endsWith('.TW') || cleanTicker.endsWith('.TWO') || /^\d{4}$/.test(cleanTicker)) {
    if (price > 5000) {
      return true;
    }
  }
  
  return false;
}

/**
 * Fetch current price for a ticker with TWSE / Yahoo Finance fallbacks and sanity checks.
 * @param {string} ticker e.g. "2330.TW", "0050.TW", "0056.TW"
 * @returns {number} Current price
 */
function getCurrentPrice(ticker) {
  if (!ticker) return 0;
  
  ticker = ticker.toString().trim();
  var cleanSymbol = ticker.replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
  
  // Attempt 1: TWSE API for Taiwan stocks (.TW / .TWO / 4-digit ticker)
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
            var z = parseFloat(item.z); // Realtime trade price
            if (!isNaN(z) && !isPriceAnomalous(ticker, z)) {
              return z;
            }
            var y = parseFloat(item.y); // Yesterday close price fallback
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
  
  // Attempt 2: Yahoo Finance API
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
