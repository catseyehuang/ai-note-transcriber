# AI 課堂學習筆記助理 (AI Class Notes Assistant) 📝✨

這是一個專門為學生與學習者設計的**單頁 Web 應用程式 (SPA)**。它能幫助您在課堂上同時錄音，並結合 Windows 內建的語音輸入功能（`Win + H`）即時生成逐字稿，最後透過 **Google Gemini API** 一鍵將粗糙的文字整理成結構化、排版美觀且適合直接貼入 **Notion** 的 Markdown 學習筆記。

---

## 🌟 核心特色

*   **🎙️ 課堂現場錄音**：使用瀏覽器 Web Audio API，無需安裝任何錄音軟體。支援暫停、繼續、結束錄製，並提供音訊播放與 WebM 格式下載。
*   **📊 動態音波視覺化**：未錄音時呈現優美的正弦波待命畫面；錄音時會即時分析音訊頻率，繪製出紫/青霓虹漸層的 3D 動態對稱頻率圖。
*   **⌨️ Windows 語音聽寫相容**：專門優化的文字區，只要點擊並按下 `Win + H` 即可開始接收 Windows 系統的即時語音轉文字。
*   **⚡ LocalStorage 自動存檔**：逐字稿與 AI 筆記每秒自動保存至瀏覽器本機快取，防斷電、網頁重新整理或誤關。
*   **🤖 一鍵 Gemini AI 整理**：直連 Google 官方 `gemini-1.5-flash` 模型，支援多種筆記風格（系統化筆記、精簡摘要、心智圖大綱、重點 Q&A），並修正口頭禪與錯別字。
*   **🔒 100% 隱私與安全**：全前端架構，您的 Gemini API Key 只儲存在您的本機瀏覽器，直接與 Google API 通訊，絕不經過任何第三方伺服器。
*   **📋 Notion 友善匯出**：一鍵複製的 Markdown 與 Notion 的 Block 語法高度相容。直接在 Notion 頁面中 `Ctrl + V` 貼上，標題、表格、代辦清單、引言會自動轉換成 Notion 元件！
*   **🔌 零依賴本機伺服器**：隨附以 PowerShell 寫成的極簡 HTTP 伺服器，按兩下即可在 localhost 安全上下文中執行（啟用麥克風權限）。

---

## 🛠️ 技術棧

*   **前端核心**：HTML5, Vanilla JavaScript, CSS3
*   **第三方套件 (CDN)**：
    *   [Lucide Icons](https://lucide.dev/) - 精美圖示
    *   [Marked.js](https://marked.js.org/) - Markdown 編譯器
*   **後端/伺服器**：Windows Native PowerShell (HttpListener)

---

## 🚀 快速開始

### 方式一：直接執行（雙擊啟動）
1. 下載本專案所有檔案至您的 Windows 電腦。
2. 對 **`start.bat`** 檔案按滑鼠左鍵**兩下**執行。
3. 系統會自動啟動本機伺服器並在您的瀏覽器打開 `http://localhost:8000/`。

### 方式二：手動在終端機啟動
若您想手動透過 PowerShell 啟動：
```powershell
# 切換至專案目錄並執行
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

---

## 📝 課堂筆記整理流程

1.  **開啟網頁**並點選右上角 **「Gemini API 設定」** 輸入您的 Gemini Key。
2.  點選 **「開始錄音」**（作為音訊備份）並允許麥克風權限。
3.  點擊 **「課堂即時逐字稿」輸入框** 使游標閃爍。
4.  按下 **`Win + H`** 鍵啟動 Windows 語音輸入，開始記錄課程內容。
5.  下課後，點擊 **「結束錄音」**，選擇想要的 **「筆記風格」**。
6.  點擊 **「透過 AI 整理筆記」**，等待 10-15 秒生成完成。
7.  點擊 **「複製至 Notion」**，並貼到您的 Notion 頁面中即完成！
