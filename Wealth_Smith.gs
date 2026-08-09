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
    .addItem('🔄 立即更新所有 XIRR 與儀表板', 'updateAllXIRR')
    .addSeparator()
    .addItem('⏰ 設定每日收盤自動更新 (14:30 Trigger)', 'setupDailyTrigger')
    .addToUi();
}

/**
 * Sets up a daily time-driven trigger to run updateAllXIRR at 14:30 Taipei time.
 */
function setupDailyTrigger() {
  // Delete existing triggers for updateAllXIRR to prevent duplicate triggers
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateAllXIRR') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  // Create daily trigger at 14:30
  ScriptApp.newTrigger('updateAllXIRR')
    .timeBased()
    .atHour(14)
    .nearMinute(30)
    .everyDays(1)
    .inTimezone('Asia/Taipei')
    .create();
    
  SpreadsheetApp.getUi().alert('⏰ 已成功設定每日 14:30 股市收盤自動更新排程！');
}
