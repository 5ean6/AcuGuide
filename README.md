# 穴穴指教 AcuGuide Web Demo

「穴穴指教」是一個個人化 AR 穴位導引與自我照護 Web Demo。此版本用來展示作品的核心流程：使用者選擇臉部美容、身體部位疼痛或調理身體目標後，系統會在 3D 頭部 / 全身人體模型上預覽推薦穴位，接著進入相機輔助定位畫面，透過 MediaPipe 偵測臉部、手部與身體姿態關鍵點，呈現穴位 AR 指引概念。

此專案目前是 Web 版原型，目標是先驗證 80% 的互動流程與展示效果，後續可再延伸為 iOS App。

## 功能特色

- 三大導引類型：臉部美容、身體部位疼痛、調理身體
- 預設目標：改善眼皮浮腫、蘋果肌澎潤、瘦小臉、淡化法令紋、肩頸痠痛、膝腿不適、脹氣腹脹等
- 3D 模型預覽：頭部模型與全身人體模型顯示穴位高亮
- MediaPipe 偵測：臉部、手部與身體姿態關鍵點偵測
- AR 指引概念：在相機畫面中輔助確認臉部或身體部位
- 穴位推薦：預設穴位組 + 本機 RAG preview；若本機 Gemma 模型存在，會嘗試使用 Gemma 4 E2B
- 安全設計方向：定位信心、按壓說明、禁忌提醒與使用者回饋

## 技術棧

- React 19
- TypeScript
- Vite
- Three.js
- MediaPipe Tasks Vision
- MediaPipe Tasks GenAI
- Lucide React
- Playwright UI verification

## 專案結構

```text
AcuGuide/
├─ src/
│  ├─ components/          # 主要 UI、3D viewer、AR / camera panels
│  ├─ data/                # 穴位、導引類型、預設目標資料
│  ├─ lib/                 # 推薦、匹配、Gemma fallback 邏輯
│  ├─ App.tsx
│  └─ styles.css
├─ public/
│  ├─ models/
│  │  ├─ head/             # Sketchfab 頭部模型與授權檔
│  │  ├─ human/            # Sketchfab 全身模型與授權檔
│  │  ├─ mediapipe/        # MediaPipe task models
│  │  └─ gemma/            # 本機 Gemma 模型放置位置，不直接上傳大型 .task
│  ├─ mediapipe/wasm/      # MediaPipe Vision WASM
│  └─ genai/wasm/          # MediaPipe GenAI WASM
├─ scripts/
│  └─ verify-ui.mjs        # Playwright UI smoke test
├─ docs/
│  └─ AcuGuide_iOS_企劃書初版.md
├─ start-local.bat
├─ package.json
└─ vite.config.ts
```

## 開始使用

### 1. 安裝依賴

```bash
npm install
```

### 2. 啟動開發伺服器

```bash
npm run dev
```

預設網址：

```text
http://127.0.0.1:5173/
```

Windows 也可以直接雙擊：

```text
start-local.bat
```

### 3. 建置正式版本

```bash
npm run build
```

### 4. 執行 UI 驗證

```bash
npm run test:ui
```

## Gemma 模型說明

GitHub 不適合直接上傳大型本機 LLM 模型。本專案目前的 Gemma web task 檔案約 1.9GB，已被 `.gitignore` 排除。

若要啟用 Gemma 4 E2B Web 推論，請自行下載或準備模型檔，並放到：

```text
public/models/gemma/gemma-4-E2B-it-web.task
```

若沒有此檔案，網站仍可正常操作預設穴位組與本機 RAG preview；自由輸入症狀時，系統會顯示 Gemma 不可用並改用本機備援推薦。

## GitHub 上傳建議

建議上傳：

```text
src/
public/models/head/
public/models/human/
public/models/mediapipe/
public/mediapipe/
public/genai/
scripts/
docs/
index.html
package.json
package-lock.json
tsconfig.json
tsconfig.app.json
tsconfig.node.json
vite.config.ts
start-local.bat
.gitignore
README.md
```

不要上傳：

```text
node_modules/
dist/
artifacts/
*.log
*.tsbuildinfo
public/models/gemma/*.task
企劃.pdf
```

可視情況上傳：

```text
docs/AcuGuide_iOS_企劃書初版.md
```

如果 GitHub repo 只想放 Web Demo 程式碼，可以保留 `docs/`；如果企劃書還在修改、暫時不想公開，可以先不要加入 commit。

## 3D 模型授權

本專案使用的頭部與全身人體模型來自 Sketchfab 下載檔案，模型資料夾內保留原始 `license.txt`。若公開展示或上架，請依照各模型授權條款標示作者與來源。

## 注意事項

本作品為自我照護與穴位學習輔助工具，不提供醫療診斷，也不能取代中醫師、醫師、物理治療師或其他專業醫療建議。若出現急性疼痛、眼部異常、皮膚破損、孕期高風險或其他不適合自行按壓的情況，應停止操作並尋求專業協助。
