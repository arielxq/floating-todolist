# Floating Todo 安裝包

## macOS

需要 Node.js 22、Rust stable 與 Apple Command Line Tools（建議使用完整 Xcode）。

```sh
npm ci
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri -- build --target universal-apple-darwin --bundles dmg
```

產物位於 `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`。
安裝工具與目標架構後，也可執行 `npm run package:mac` 重建。
Universal 安裝包支援 Apple Silicon 與 Intel Mac，最低 macOS 11。
開啟 DMG 後將 Floating Todo 拖入 Applications。

本機建置使用 ad-hoc 簽署，未經 Apple Developer ID 簽署及公證。首次開啟可能需在「系統設定 → 隱私權與安全性」選擇「仍要打開」。對外發佈前可透過 Tauri 的 Apple 簽署環境變數加入 Developer ID 與公證憑證。

## Windows

在 Windows x64 上安裝 Node.js 22、Rust stable（MSVC）與 Visual Studio Build Tools 的「使用 C++ 的桌面開發」工具。

```powershell
npm ci
npm run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis
```

產物位於 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`。
也可在 Windows 執行 `npm run package:win` 重建。
安裝精靈支援英文與繁體中文。Windows 10／11 需要 WebView2；若未安裝，安裝精靈預設會下載所需元件。
未簽署的安裝包可能顯示 SmartScreen 提示。

## 使用 GitHub Actions 建置兩個平台

將此專案放入自己的 GitHub repository 後，在 Actions 選擇 **Build desktop installers → Run workflow**。
完成後可在該次工作流程的 Artifacts 下載 macOS DMG 與 Windows EXE。工作流程只上傳建置產物，不會自動建立公開 Release。

## 驗收

在各平台安裝後，確認首次選擇資料夾、新增任務、重新開啟後保留任務與分組、置頂、透明效果、四邊吸附及收合展開。
任務資料保存在使用者選擇的資料夾內，不隨安裝包附帶，也不需帳號。
