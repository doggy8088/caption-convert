# caption-convert

將字幕檔在 `.srt`、`.vtt`、`.ass` 之間互相轉換的命令列工具。

## 功能

- 支援格式：SRT、WebVTT、ASS
- 將字幕檔轉成另一種格式
- 無第三方相依套件，直接用 Node.js 執行

## 環境需求

- Node.js 18 以上（建議使用 LTS）

## 安裝

### 方式一：全域安裝

```powershell
npm i -g @willh/caption-convert
```

安裝後即可使用 `caption-convert` 指令。

### 方式二：本機連結（開發用）

```powershell
npm link
```

## Agent Skill 安裝

若你使用支援 Skills 的 Agent／CLI（例如 Codex CLI），可透過 `skills` 指令安裝此專案的 Skill：

```txt
npx skills add https://github.com/doggy8088/caption-convert --skill caption-convert
```

## 使用方式

### 以 CLI 指令執行

```powershell
caption-convert input.srt output.vtt
```

### 不安裝，直接執行

```powershell
node .\src\cli.mjs input.vtt output.ass
```

### 使用 npx 執行（免安裝）

```powershell
npx @willh/caption-convert input.ass output.srt
```

## 參數說明

```
caption-convert [source] [target]
```

- `source`：來源字幕檔（副檔名需為 `.srt` / `.vtt` / `.ass`）
- `target`：輸出字幕檔（副檔名需為 `.srt` / `.vtt` / `.ass`）

## 範例

```powershell
caption-convert demo.srt demo.vtt
caption-convert demo.vtt demo.ass
caption-convert demo.ass demo.srt
```

## 注意事項

- 會依副檔名判斷輸入與輸出格式。
- 若格式不支援或參數不足，會顯示使用說明。

## 授權

MIT
