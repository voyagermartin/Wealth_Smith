/**
 * Wealth_Smith GAS - Main Entry & Custom Menu Setup
 */

/**
 * Automatically creates custom menu on spreadsheet open.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Wealth_Smith 儀表板')
    .addItem('⚡ 初始化 / 重置工作表 (Setup Sheets)', 'setupAllSheets')
    .addToUi();
}
