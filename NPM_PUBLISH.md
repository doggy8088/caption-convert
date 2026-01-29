# NPM 發佈準備與「最小化」打包指南（caption-convert）

> 目標：發佈到 npm registry（公開套件），並盡量只發佈「執行所需檔案」，避免把 repo 內的開發用內容（例如 `skills/`、`src/`）一起包進去。

## 1) 先釐清：npm 套件不可能「完全不含原始碼」

本專案是 Node.js CLI（JavaScript）。即使你把 `src/` 排除掉，最終仍需要把可執行的 `.js/.mjs` 檔放進 npm 套件中，使用者安裝後才能執行；因此**「完全不讓人看到程式內容」在 npm 發佈 JS CLI 的模式下做不到**。

你能做到的是：

- **不要把 repo 的開發原始碼/多餘資料夾一起發佈**（例如 `skills/`、測試、文件、範例等）
- 只發佈 `dist/`（發佈產物），讓套件內容最小化

## 2) 目前專案現況（你現在的 repo）

目前主要檔案/資料夾：

- `src/cli.mjs`：CLI 主程式（Node.js 內建模組，無第三方相依）
- `skills/`：Codex CLI skill 相關文件與 bundled CLI（不屬於 npm runtime 必需）

用 `npm pack --dry-run` 檢查時，若沒有做打包控制，`skills/` 也會被一起包進去（你通常不希望這樣）。

## 3) 建議做法：用 `files` 白名單，只發佈 `dist/`

### 為什麼推薦 `files`？

- `files` 是**白名單**：只有列出的路徑會被打包（更安全、可預期）
- `.npmignore` 是**黑名單**：容易漏掉新資料夾（較常造成「不小心把不該發佈的東西也發出去了」）

### 建議的目標打包內容

理想上發佈到 npm 的檔案應該只有：

- `dist/cli.mjs`（可執行檔）
- `package.json`（必要）
- `README.md`、`LICENSE`（npm 會自動納入常見檔案）

## 4) 建議流程：用 `prepare` 產生 `dist/`，再 publish

推薦流程如下（已符合「最小化打包」的常見做法）：

1. 開發時維持 `src/` 當作原始碼
2. 透過 `npm run build` 產出 `dist/`
3. 透過 `files: ["dist/"]` 確保 publish 時只包含 `dist/`
4. `npm publish` 前用 `npm pack --dry-run` 確認內容

### 常用指令

檢查最終會被 publish 的內容（務必做）：

```powershell
npm pack --dry-run
```

實際發佈（scoped 套件第一次公開通常需要 public access）：

```powershell
npm publish
```

> 你也可以改用：`npm publish --access public`（若未設定 `publishConfig.access`）

## 5) 發佈前檢查清單（建議照順序）

1. 登入 npm（第一次或 token 失效時）
   - `npm login`
   - `npm whoami`
2. 確認套件名稱/權限
   - scoped 套件如 `@willh/caption-convert`：第一次公開需 `public`
3. 調整版本號
   - `npm version patch` / `npm version minor` / `npm version major`
4. 先做一次「乾跑」檢查打包內容
   - `npm pack --dry-run`
5. 正式 publish
   - `npm publish`

## 6) 發佈後驗證（建議）

用 `npx` 直接跑已發佈版本（確認 `bin` 正常）：

```powershell
npx @willh/caption-convert input.srt output.vtt
```

或全域安裝後測試：

```powershell
npm i -g @willh/caption-convert
caption-convert input.srt output.ass
```

