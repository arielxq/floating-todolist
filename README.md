# Floating Todo

**把待辦放在手邊，讓注意力留在工作上。**

Floating Todo 是以 Tauri、React 與 TypeScript 製作的桌面懸浮待辦工具。透過透明視窗、快速收合與本機儲存，隨時記錄任務、整理分組、掌握截止日，無須建立帳號。

[開啟產品簡報](presentation.html) · [安裝與打包說明](BUILDING.md)

## 功能亮點

| 功能 | 使用方式與價值 |
| --- | --- |
| 桌面懸浮 | 視窗置頂、釘選展開、失焦後延遲收合，減少切換工具的次數。 |
| 四邊吸附 | 視窗靠邊收合為浮動泡泡，可直接拖曳泡泡並向螢幕內側展開。 |
| 毛玻璃介面 | 可調整背景不透明度與模糊程度；預設不透明度為 38%。 |
| 四種任務狀態 | 待辦、暫緩、已完成、已取消，點擊卡片狀態標籤即可切換。 |
| 快速完成與復原 | 點擊圓圈完成任務，六秒內可復原；已完成任務也可重新開啟。 |
| 自訂分組 | 自訂名稱、從 12 種圖示選擇、拖曳或方向鍵調整順序，刪除時轉移任務。 |
| 截止日與急迫程度 | 設定今天或未來日期，顯示逾期、今天及七天內的期限標示與卡片色條。 |
| 三種排序 | 手動 → 最近截止優先 → 最晚截止優先；無截止日的任務在日期排序中置後。 |
| 雙語介面 | 繁體中文／英文即時切換，保留使用者輸入的任務文字與自訂分組名稱。 |
| 本機資料 | 桌面版將任務及分組存入自行選擇的資料夾，提供寫入備份與版本衝突檢查。 |

> 截止日以畫面標示提醒，目前未提供系統推播通知、重複任務或雲端同步。

## 開始使用

### macOS

已發布 **v0.1.0 Universal DMG**，內含 Apple Silicon 與 Intel 兩種架構，最低系統需求為 macOS 11。

1. 到 [GitHub Release v0.1.0](https://github.com/arielxq/floating-todo/releases/tag/v0.1.0) 下載 `Floating Todo_0.1.0_universal.dmg`。
2. 開啟 DMG，將 Floating Todo 拖入「應用程式」。
3. 啟動後選擇任務資料夾，再新增自己的第一筆任務。

安裝包使用 ad-hoc 簽署，尚未經 Apple Developer ID 簽署及公證。若 macOS 阻擋首次開啟，可到「系統設定 → 隱私權與安全性」選擇「仍要打開」。

從原始碼下載專案時，亦可依 [BUILDING.md](BUILDING.md) 自行建置。

### Windows

已透過 GitHub Actions 產出 **Windows x64 NSIS EXE**，安裝精靈支援英文／繁體中文，可從 [GitHub Release v0.1.0](https://github.com/arielxq/floating-todo/releases/tag/v0.1.0) 下載 `Floating Todo_0.1.0_x64-setup.exe`。

1. 執行安裝精靈完成安裝（支援中英文選擇）。
2. 啟動後選擇任務資料夾，再新增第一筆任務。

Windows 10／11 需要 WebView2；缺少時安裝精靈預設會下載該元件。未簽署的安裝包可能顯示 SmartScreen 提示。Windows 實機安裝與操作仍需驗收。

亦可在 Windows 電腦自行建置，或將專案放入 GitHub repository 後執行 [Build desktop installers](.github/workflows/installers.yml)。

## 日常操作

1. **記錄**：在底部輸入任務並按 Enter。輸入欄取得焦點後可指定分組與截止日。
2. **整理**：點擊卡片上的狀態、分組或日期編輯；雙擊任務標題修改文字。
3. **聚焦**：使用頂部分頁查看四種狀態，再用分組下拉選單縮小範圍。
4. **排序**：點擊工具列排序圖示循環切換模式；手動模式可拖曳任務調整順序，也可拖至狀態分頁變更狀態。
5. **完成**：點擊任務圓圈，誤操作時使用六秒內出現的「復原」。
6. **收好**：使用收合按鈕，或開啟失焦自動收合；需要常駐展開時使用釘選。

日期清除按鈕會在滑鼠停留或鍵盤焦點進入時出現，確認後才會移除日期。既有的逾期日期會保留，但重新設定時僅接受今天或未來日期。

從「設定 → 管理分組」新增分組、選擇圖示、雙擊名稱或按 Enter 重新命名；刪除分組時需選擇任務轉入的分組。

## 資料儲存與隱私

- **桌面版**：任務與分組存於選定資料夾的 `tasks.json`；更新既有檔案前，將舊版本存入同資料夾的 `backups/`。
- **衝突處理**：透過 revision 檢查外部修改；偵測版本不符時停止覆寫並顯示錯誤。這不是多裝置同步機制。
- **瀏覽器預覽**：使用目前瀏覽器的 `localStorage`，與桌面版資料分開；清除網站資料可能移除預覽任務。
- **本機偏好**：語言、視窗及顯示設定保存在應用程式的本機 WebView 儲存空間。

任務資料不需要帳號、雲端資料庫或網路連線。備份仍位於同一資料夾，重要資料建議另外備份至其他儲存裝置。

## 開發與預覽

建議使用 Node.js 22 與 npm。

```sh
npm ci
npm run dev
```

在終端機顯示的網址開啟瀏覽器預覽。預覽能操作任務介面，但真正的桌面透明、置頂與視窗吸附需要原生版。

```sh
npm run build       # TypeScript 檢查與前端正式建置
npm run tauri dev   # 原生桌面開發，需要 Rust 與平台工具
npm run package:mac # macOS Universal DMG，需要兩種 Rust 目標架構
npm run package:win # 在 Windows 建置 x64 EXE，需要 MSVC 工具
```

平台工具安裝與 CI 使用方式請見 [BUILDING.md](BUILDING.md)。

## 產品簡報

直接以瀏覽器開啟 [presentation.html](presentation.html)，無須啟動開發伺服器或連線。簡報包含八頁產品介紹與介面示意，支援前後頁按鈕、方向鍵、Home／End、頁碼連結，以及列印／另存 PDF。示意圖不是原生版截圖。

## 技術與目錄

使用 **Tauri 2 · React 18 · TypeScript · Vite · Rust · Lucide**。

```text
src/                         React 介面、分組、日期及視窗定位邏輯
src-tauri/                   原生視窗、檔案儲存、權限與安裝包設定
.github/workflows/           macOS / Windows 安裝包建置流程
presentation.html            離線產品簡報
BUILDING.md                  平台建置與驗收說明
```

## 驗證狀態

- 前端正式建置已通過；瀏覽器已驗證中英文、320px 窄視窗、狀態選單、分組篩選、排序及完成復原。
- macOS Universal 原生建置、DMG 完整性、雙架構與 ad-hoc 簽章驗證已通過。
- macOS 原生完整操作、透明效果、多螢幕與吸附仍需實機驗收。
- Windows x64 建置成功（GitHub Actions），安裝包已發布至 Release v0.1.0；Windows 實機安裝與操作仍需驗收。
