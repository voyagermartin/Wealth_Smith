/**
 * Wealth_Smith GAS - Price Fetcher Module
 * Handles stock price fetching with fallback mechanisms.
 */

/**
 * Fetch current price for a ticker.
 * @param {string} ticker e.g. "2330.TW", "0050.TW"
 * @returns {number} Current price
 */
function getCurrentPrice(ticker) {
  if (!ticker) return 0;
  
  // Clean ticker
  ticker = ticker.toString().trim();
  
  // Attempt 1: Fetch via Yahoo Finance API
  try {
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      var json = JSON.parse(response.getContentText());
      var meta = json.chart.result[0].meta;
      var price = meta.regularMarketPrice;
      if (price && !isNaN(price)) {
        return parseFloat(price);
      }
    }
  } catch (e) {
    Logger.log('Yahoo Finance API error for ' + ticker + ': ' + e.message);
  }
  
  // Attempt 2: TWSE API for Taiwan stocks (.TW)
  if (ticker.toUpperCase().endsWith('.TW')) {
    try {
      var stockId = ticker.split('.')[0];
      var twseUrl = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_' + stockId + '.tw';
      var twseResp = UrlFetchApp.fetch(twseUrl, { muteHttpExceptions: true });
      if (twseResp.getResponseCode() === 200) {
        var twseJson = JSON.parse(twseResp.getContentText());
        if (twseJson.msgArray && twseJson.msgArray.length > 0) {
          var z = twseJson.msgArray[0].z; // Trade price
          if (z && z !== '-') {
            return parseFloat(z);
          }
          var y = twseJson.msgArray[0].y; // Yesterday close price fallback
          if (y && y !== '-') {
            return parseFloat(y);
          }
        }
      }
    } catch (e) {
      Logger.log('TWSE API error for ' + ticker + ': ' + e.message);
    }
  }
  
  return 0;
}
