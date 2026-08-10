# Wealth_Smith：GAS 存股金流自動化管理系統開發手冊 (Handbook)

## 專案核心理念
結合 Google Sheets 的彈性介面與 Google Apps Script (GAS) 的自動化引擎，實現買賣交易、股息流向、個股與整體投資組合的 XIRR、總成本與總報酬率即時精算，打造被動收入自動化追蹤利器。

---

## 一、 團隊協作角色權責 (Roles & Responsibilities)
* **產品架構師 / 總指揮 (腦袋 - Gemini)**： 負責系統架構設計、演算法邏輯（如 XIRR 現金流計算）、資料庫表單規劃、驗收標準定義與撰寫執行指令 (Prompts)。
* **工程實作師 (施工 - AntiGravity)**： 負責建立 Google Sheets 結構、寫入 GAS 腳本代碼、測試執行、除錯與佈署排程觸發器 (Triggers)。
* **專案擁有者 (Martin)**： 需求審查、成果驗收與系統最終使用。

---

## 二、 系統核心架構與資料表規劃 (Database Architecture)

### 1. 工作表一：Transactions（買賣交易明細）
記錄每一次進場買進與賣出之交易資料。

| 欄位名稱 (A-I) | 欄位代號 | 型態 | 說明與格式範例 |
| :--- | :--- | :--- | :--- |
| 交易日期 | Date | Date | YYYY-MM-DD（例如：2026-01-15） |
| 股票代號 | Ticker | Text | 台股請加副檔名，如 2330.TW, 0050.TW |
| 股票名稱 | Name | Text | 例如：台積電、元大台灣50 |
| 交易類型 | Type | Dropdown | 買入 / 賣出 |
| 成交均價 | Price | Number | 每股成交價格 |
| 購買股數 | Shares | Number | 交易股數 |
| 投資金額 | Amount | Formula/Number | 成交均價 × 購買股數 |
| 手續費 | Fee | Number | 券商手續費（交易實際支出） |
| 淨現金流 | NetCashFlow | Formula | 買入：-(投資金額 + 手續費)<br>賣出：+(投資金額 - 手續費) |

### 2. 工作表二：Dividends（股息紀錄）
記錄除息與實際股息入帳狀況。

| 欄位名稱 (A-G) | 欄位代號 | 型態 | 說明與格式範例 |
| :--- | :--- | :--- | :--- |
| 除息日 | ExDate | Date | YYYY-MM-DD |
| 發放日 | PayDate | Date | YYYY-MM-DD（實務上以此日期作為 XIRR 現金流入日） |
| 股票代號 | Ticker | Text | 例如：0050.TW |
| 每股股利 | DPS | Number | 每股配發現金股利金額 |
| 持有股數 | SharesHeld | Number | 除息時持有的總股數 |
| 總股利金額 | TotalDividend | Formula/Number | 每股股利 × 持有股數（或實際扣稅扣匯費後入帳金額） |
| 淨現金流 | NetCashFlow | Formula | +總股利金額（正現金流） |

### 3. 工作表三：Dashboard（總覽與個股儀表板）

#### (A) 全域投資總覽 (Global Summary)
| 指標名稱 | 計算邏輯 / 公式說明 |
| :--- | :--- |
| 總投入成本 | 所有 Transactions 買入金額 + 手續費之總和 |
| 總股息收入 | 所有 Dividends 總股利金額之總和 |
| 總當下市值 | 各個股（累積股數 × 當前即時股價）之總和 |
| 總損益 (Unrealized + Dividend) | (總當下市值 + 總股息收入) - 總投入成本 |
| 總報酬率 (%) | 總損益 / 總投入成本 |
| 整體 XIRR (%) | 由 GAS 整合所有歷史交易買賣現金流(-)、歷史股息現金流(+)與今日當下總市值(+)進行不定期現金流內部報酬率演算（支援 `=PORTFOLIO_XIRR()` 自訂公式）。 |

#### (B) 個股彙整表 (Per-Stock Breakdowns)
| 欄位 | 計算來源與說明 |
| :--- | :--- |
| 投資標的 (Ticker) | 股票代號（如 2330.TW）與名稱 |
| 個股總投入成本 | 該標的於 Transactions 之買入金額與手續費加總 |
| 累積股數 | 該標的（買進股數 - 賣出股數）之累計值 |
| 平均持股成本 | 個股總投入成本 / 累積股數 |
| 當前現價 | 由 `=IFERROR(GOOGLEFINANCE("TPE:" & SUBSTITUTE(A10, ".TW", ""), "price"), PriceFetcher_Backup(A10))` 即時更新，具備數值合理性過濾與雙重 API 備援 |
| 個股目前總市值 | 累積股數 × 當前現價 |
| 個股總股息收入 | 該標的於 Dividends 之總股利加總 |
| 個股總報酬率 (%) | [(個股目前總市值 + 個股總股息收入) - 個股總投入成本] / 個股總投入成本 |
| 個股 XIRR (%) | 由 GAS 提取該標的專屬之交易現金流、股息現金流及今日變現市值進行計算（支援 `=STOCK_XIRR(A10)` 自訂公式）。 |

---

## 三、 演算法邏輯與 GAS 模組規劃 (Technical Implementation)

### 1. XIRR 核心計算邏輯 (Cash Flow Model)
XIRR 需要建構嚴謹的時間軸與帶符號現金流數組：
* **現金流出 (Negative Flow)**： 每次買入股票日，金額為 `-(股價 × 股數 + 手續費)`。
* **現金流入 (Positive Flow)**： 每次配息入帳日 (PayDate)，金額為 `+(實際入帳股息)`。若有賣出股票，則為 `+(賣出金額 - 手續費)`。
* **期末結算 (Terminal Value)**： 以 今天日期 (Today) 為基準，新增一筆虛擬現金流入，金額為 `+(該標的當下總市值)`。

將上述二維陣列 `[[Date1, Value1], [Date2, Value2], ..., [Today, CurrentValue]]` 帶入 Newton-Raphson 迭代演算法，解出折現率 $r$ 即為 XIRR。

### 2. GAS 模組架構規劃 (Script Architecture)
```text
Wealth_Smith_GAS/
├── Wealth_Smith.gs  // 系統主入口、自訂頂部選單、全功能單檔備援整合與每日收盤觸發器 (setupDailyTrigger)
├── SheetSetup.gs    // 初始化工具：自動建立三張工作表 (Transactions, Dividends, Dashboard) 與格式驗證
├── XIRREngine.gs    // 核心計算引擎：Newton-Raphson 演算法，支援 STOCK_XIRR 與 PORTFOLIO_XIRR 自訂公式
├── PriceFetcher.gs  // 股價抓取與備援機制 (PriceFetcher_Backup 自訂函式 / TWSE OpenAPI / Yahoo Finance / isPriceAnomalous 合理性過濾)
├── .clasp.json      // Google Clasp 專案部署設定檔 (綁定特定 Sheet 專案 ID)
└── appsscript.json  // GAS 時區 (Asia/Taipei) 與執行環境設定檔
```

---

## 四、 專案開工四步驟 (Implementation Roadmap)

* **Phase 1: 試算表結構與格式初始化（✅ 已完成）**
  * 建立 `Transactions`、`Dividends`、`Dashboard` 三張工作表與標準表頭。
  * 設定資料驗證（日期格式、交易類型下拉選單）與條件式格式。
* **Phase 2: 基礎試算表公式與現價整合（✅ 已完成）**
  * 設定各表內部自動加減與累計公式。
  * 導入 `GOOGLEFINANCE("TPE:...")` 與 `PriceFetcher_Backup` 抓取當前報價。
* **Phase 3: GAS XIRR 核心演算法與自訂函數開發（✅ 已完成）**
  * 寫入 `XIRREngine.gs`，實現支援跨表整合的 Newton-Raphson XIRR 計算。
  * 開發 `=STOCK_XIRR(ticker)` 與 `=PORTFOLIO_XIRR()` 自訂公式於 Dashboard 產出動態 XIRR 結果。
* **Phase 4: 自動化觸發與使用者體驗優化（✅ 已完成）**
  * 新增 Google Sheets 頂部選單「Wealth_Smith 儀表板」。
  * 實作 `setupDailyTrigger()` 設定每日 14:30 收盤自動更新與 CI/CD `clasp push` / `clasp deploy` 自動化部署。

---

## 五、 開發日誌 (Development Log)

### 📅 2026-08-09
* **專案初始化與版本控制**：
  * 建立系統開發手冊 [HANDBOOK.md](file:///f:/Projects/Wealth_Smith/HANDBOOK.md) 與 [.gitignore](file:///f:/Projects/Wealth_Smith/.gitignore)。
  * 初始化本地 Git 儲存庫並連動 GitHub 遠端儲存庫 (`main` 分支)。
* **Phase 1 & Phase 2 試算表結構開發**：
  * 開發 `SheetSetup.gs` 模組，實現一鍵自動建立並格式化 `Transactions`、`Dividends` 與 `Dashboard` 三大工作表。
  * 加入資料驗證 (下拉選單 `買入`/`賣出`)、`yyyy-mm-dd` 日期格式化與加總公式，並注入 initial 測試資料 (`2330.TW`)。
* **Phase 3 XIRR 計算引擎與現價備援**：
  * 開發 `XIRREngine.gs` 核心演算法，基於 Newton-Raphson 法與 Bisection 備援，支援個股與全域投資組合不定期現金流內部報酬率 (XIRR) 精算。
  * 開發 `PriceFetcher.gs` 模組，整合 Yahoo Finance API 與台灣證交所 (TWSE) API 作為 `GOOGLEFINANCE` 的即時備援。
* **Phase 4 頂部選單、排程觸發器與 Clasp 自動化部署**：
  * 開發 `Wealth_Smith.gs` 系統主入口，於 Google Sheets 注入「Wealth_Smith 儀表板」自訂選單。
  * 實作 `setupDailyTrigger()` 函數，可一鍵設定每日 14:30 股市收盤自動背景更新。
  * 配置 `.clasp.json` 與 `.claspignore`，完成 Google Clasp CLI 工具繫結授權，實現全自動一鍵部署程式碼至 Google Sheet 線上 Apps Script 專案。

### 📅 2026-08-10
* **現價抓取機制優化與 GOOGLEFINANCE 格式修正**：
  * 將 Dashboard 現價預設公式修正為 `=IFERROR(GOOGLEFINANCE("TPE:" & SUBSTITUTE(A10, ".TW", ""), "price"), PriceFetcher_Backup(A10))`，採用 `TPE:` 前綴提升台股報價穩定度。
  * 於 `PriceFetcher.gs` 開發 `PriceFetcher_Backup(ticker)` 自訂函式，整合台灣證交所 (TWSE) OpenAPI (`mis.twse.com.tw`) 與 Yahoo Finance API 作為多重備援機制。
  * 新增 `isPriceAnomalous` 數值合理性檢查過濾（如 0056.TW 價格需介於 10~200 元之間，一般台股 ≤ 5000 元），避免極端異常報價（如 600 元）影響總市值與 XIRR 計算。
* **自訂公式引擎開發 (`STOCK_XIRR` & `PORTFOLIO_XIRR`)**：
  * 於 `XIRREngine.gs` 新增 `=STOCK_XIRR(ticker)` 與 `=PORTFOLIO_XIRR()` 自訂公式，實現無需手動點選選單、輸入交易即可自動即時精算個股與整體投資組合 XIRR 之功能。
* **Clasp 部署架構與專案綁定校正**：
  * 排除多副檔名 (`.js`/`.gs`) 上傳衝突問題，確立 `.gs` 模組導向與 `.claspignore` 規則。
  * 校正 `.clasp.json` 綁定之雲端 Apps Script `scriptId` (`1hKL8YRW3vXj7wm6eShnZmZT_PxjZWdlpC4fpJADFWUIKIZN9vUy1Kx7X`)，並將所有模組整合至 `Wealth_Smith.gs` 作為全功能單檔備援，完成 `Version 1.0` 雲端正式版本發布。
