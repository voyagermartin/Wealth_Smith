/**
 * Wealth_Smith GAS - Sheet Setup Module
 * Automates creation, formatting, formulas, validation rules, and sample test data.
 */

function setupAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  setupTransactionsSheet(ss);
  setupDividendsSheet(ss);
  setupDashboardSheet(ss);
  
  SpreadsheetApp.getUi().alert('✅ Wealth_Smith 核心工作表結構與測試資料已成功初始化！');
}

/**
 * 1. Transactions 工作表 (買賣交易明細)
 */
function setupTransactionsSheet(ss) {
  var sheetName = 'Transactions';
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  // 清除現有內容與格式
  sheet.clear();
  sheet.setHiddenGridlines(false);
  
  // 表頭 Row 1
  var headers = [
    ['交易日期', '股票代號', '股票名稱', '交易類型', '成交均價', '購買股數', '投資金額', '手續費', '淨現金流']
  ];
  sheet.getRange(1, 1, 1, 9).setValues(headers);
  
  // 表頭樣式 (Navy Dark Blue with bold white text)
  var headerRange = sheet.getRange(1, 1, 1, 9);
  headerRange.setBackground('#1A365D')
             .setFontColor('#FFFFFF')
             .setFontWeight('bold')
             .setHorizontalAlignment('center')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  
  // 資料驗證 (D欄: 買入 / 賣出 下拉選單)
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['買入', '賣出'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('D2:D500').setDataValidation(typeRule);
  
  // 日期與數字格式
  sheet.getRange('A2:A500').setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
  sheet.getRange('B2:C500').setHorizontalAlignment('center');
  sheet.getRange('D2:D500').setHorizontalAlignment('center');
  sheet.getRange('E2:I500').setNumberFormat('$#,##0.00');
  
  // 填入公式 (Row 2 至 100)
  for (var r = 2; r <= 100; r++) {
    sheet.getRange(r, 7).setFormula('=IF(OR(ISBLANK(E' + r + '), ISBLANK(F' + r + ')), "", E' + r + '*F' + r + ')');
    sheet.getRange(r, 9).setFormula('=IF(ISBLANK(G' + r + '), "", IF(D' + r + '="買入", -(G' + r + '+H' + r + '), (G' + r + '-H' + r + ')))');
  }
  
  // 填入 2 筆測試資料
  var testData = [
    [new Date('2026-01-15'), '2330.TW', '台積電', '買入', 600, 1000, '', 20, ''],
    [new Date('2026-02-15'), '2330.TW', '台積電', '買入', 620, 500, '', 10, '']
  ];
  sheet.getRange(2, 1, 2, 9).setValues(testData);
  
  // 自動調整欄寬
  for (var col = 1; col <= 9; col++) {
    sheet.autoResizeColumn(col);
    sheet.setColumnWidth(col, Math.max(sheet.getColumnWidth(col) + 15, 100));
  }
}

/**
 * 2. Dividends 工作表 (股息紀錄)
 */
function setupDividendsSheet(ss) {
  var sheetName = 'Dividends';
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  sheet.clear();
  sheet.setHiddenGridlines(false);
  
  // 表頭 Row 1
  var headers = [
    ['除息日', '發放日', '股票代號', '每股股利', '持有股數', '總股利金額', '淨現金流']
  ];
  sheet.getRange(1, 1, 1, 7).setValues(headers);
  
  // 表頭樣式 (Dark Emerald Green with bold white text)
  var headerRange = sheet.getRange(1, 1, 1, 7);
  headerRange.setBackground('#1C4532')
             .setFontColor('#FFFFFF')
             .setFontWeight('bold')
             .setHorizontalAlignment('center')
             .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 35);
  
  // 格式與公式
  sheet.getRange('A2:B500').setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
  sheet.getRange('C2:C500').setHorizontalAlignment('center');
  sheet.getRange('D2:D500').setNumberFormat('$#,##0.00');
  sheet.getRange('E2:E500').setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange('F2:G500').setNumberFormat('$#,##0.00');
  
  // 填入公式 (Row 2 至 100)
  for (var r = 2; r <= 100; r++) {
    sheet.getRange(r, 6).setFormula('=IF(OR(ISBLANK(D' + r + '), ISBLANK(E' + r + ')), "", D' + r + '*E' + r + ')');
    sheet.getRange(r, 7).setFormula('=IF(ISBLANK(F' + r + '), "", +F' + r + ')');
  }
  
  // 填入 1 筆測試股息資料
  var testData = [
    [new Date('2026-03-18'), new Date('2026-04-10'), '2330.TW', 3.5, 1500, '', '']
  ];
  sheet.getRange(2, 1, 1, 7).setValues(testData);
  
  for (var col = 1; col <= 7; col++) {
    sheet.autoResizeColumn(col);
    sheet.setColumnWidth(col, Math.max(sheet.getColumnWidth(col) + 15, 110));
  }
}

/**
 * 3. Dashboard 工作表 (總覽與個股儀表板)
 */
function setupDashboardSheet(ss) {
  var sheetName = 'Dashboard';
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  
  sheet.clear();
  sheet.setHiddenGridlines(false);
  
  // -------------------------------------------------------------
  // 區域 1: 全域總覽 (Block A1:B6)
  // -------------------------------------------------------------
  var globalHeaders = [
    ['全域投資總覽', '數值'],
    ['總投入成本', '=SUMIF(Transactions!D2:D, "買入", Transactions!G2:G)+SUM(Transactions!H2:H)'],
    ['總股息收入', '=SUM(Dividends!F2:F)'],
    ['總當下市值', '=SUM(G10:G100)'],
    ['總未實現+已實現損益', '=(B4+B3)-B2'],
    ['總投資報酬率 (%)', '=IF(B2=0, 0, B5/B2)'],
    ['整體 XIRR (%)', '(待 Phase 3 核心計算引擎對接)']
  ];
  
  sheet.getRange(1, 1, 7, 2).setFormulas(
    globalHeaders.map(function(row) {
      return [
        row[0], 
        row[1].toString().startsWith('=') ? row[1] : ''
      ];
    })
  );
  
  // 寫入非公式標籤與內容
  sheet.getRange('A1').setValue('全域投資總覽指標');
  sheet.getRange('B1').setValue('金額 / 比例');
  sheet.getRange('A2').setValue('總投入成本');
  sheet.getRange('A3').setValue('總股息收入');
  sheet.getRange('A4').setValue('總當下市值');
  sheet.getRange('A5').setValue('總損益 (含股息)');
  sheet.getRange('A6').setValue('總投資報酬率 (%)');
  sheet.getRange('A7').setValue('整體 XIRR (%)');
  sheet.getRange('B7').setValue('計算中...');
  
  // 區塊 1 樣式 (Sleek Slate Blue)
  sheet.getRange('A1:B1').setBackground('#2B6CB0')
                         .setFontColor('#FFFFFF')
                         .setFontWeight('bold')
                         .setHorizontalAlignment('center');
  
  sheet.getRange('A2:A7').setBackground('#EDF2F7').setFontWeight('bold');
  sheet.getRange('B2:B5').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  sheet.getRange('B6').setNumberFormat('0.00%').setFontWeight('bold').setHorizontalAlignment('right');
  sheet.getRange('B7').setHorizontalAlignment('center').setFontColor('#718096');
  
  // -------------------------------------------------------------
  // 區域 2: 個股明細彙整表 (Row 9 標頭, Row 10 資料)
  // -------------------------------------------------------------
  var stockHeaders = [
    ['股票代號', '股票名稱', '個股總成本', '累積股數', '平均持股成本', '當前現價', '個股目前總市值', '個股總股息', '個股總報酬率(%)', '個股 XIRR(%)']
  ];
  sheet.getRange(9, 1, 1, 10).setValues(stockHeaders);
  
  var stockHeaderRange = sheet.getRange(9, 1, 1, 10);
  stockHeaderRange.setBackground('#2D3748')
                  .setFontColor('#FFFFFF')
                  .setFontWeight('bold')
                  .setHorizontalAlignment('center')
                  .setVerticalAlignment('middle');
  sheet.setRowHeight(9, 32);
  
  // Row 10 測試個股 (2330.TW) 動態公式
  sheet.getRange('A10').setValue('2330.TW').setHorizontalAlignment('center');
  sheet.getRange('B10').setValue('台積電').setHorizontalAlignment('center');
  sheet.getRange('C10').setFormula('=SUMIFS(Transactions!G:G, Transactions!B:B, A10, Transactions!D:D, "買入") + SUMIFS(Transactions!H:H, Transactions!B:B, A10)');
  sheet.getRange('D10').setFormula('=SUMIFS(Transactions!F:F, Transactions!B:B, A10, Transactions!D:D, "買入") - SUMIFS(Transactions!F:F, Transactions!B:B, A10, Transactions!D:D, "賣出")');
  sheet.getRange('E10').setFormula('=IF(D10=0, 0, C10/D10)');
  sheet.getRange('F10').setFormula('=IF(ISBLANK(A10), "", IFERROR(GOOGLEFINANCE(A10, "price"), 600))');
  sheet.getRange('G10').setFormula('=IF(ISBLANK(A10), "", D10*F10)');
  sheet.getRange('H10').setFormula('=SUMIFS(Dividends!F:F, Dividends!C:C, A10)');
  sheet.getRange('I10').setFormula('=IF(C10=0, 0, ((G10+H10)-C10)/C10)');
  sheet.getRange('J10').setValue('計算中...').setHorizontalAlignment('center').setFontColor('#718096');
  
  // 欄位格式
  sheet.getRange('C10:C100').setNumberFormat('$#,##0.00');
  sheet.getRange('D10:D100').setNumberFormat('#,##0').setHorizontalAlignment('right');
  sheet.getRange('E10:G100').setNumberFormat('$#,##0.00');
  sheet.getRange('H10:H100').setNumberFormat('$#,##0.00');
  sheet.getRange('I10:I100').setNumberFormat('0.00%').setFontWeight('bold');
  
  // 欄寬調整
  for (var col = 1; col <= 10; col++) {
    sheet.autoResizeColumn(col);
    sheet.setColumnWidth(col, Math.max(sheet.getColumnWidth(col) + 15, 110));
  }
}
