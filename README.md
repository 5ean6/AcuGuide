# 穴穴指教 AcuGuide Web Demo

AcuGuide 是「穴穴指教」競賽作品的 Web Demo，用來展示企劃書中的核心自我照護流程：從臉部美容、身體部位疼痛、調理身體三大情境出發，完成症狀輸入、安全審核、穴位推薦、3D 模型理解、相機輔助定位、按需校正、完成與本機回饋。

此 Repository 是比賽現場展示用的瀏覽器原型。原始產品規劃以 iOS App、ARKit、Vision、on-device Gemma 4 E2B 與 EmbeddingGemma RAG 為目標；Web 版先驗證互動流程、資料結構、3D/MediaPipe 可行性與安全分流。

## Demo 邊界

目前 Web Demo 真實執行：

- React / TypeScript / Vite 單頁應用
- 本機穴位資料庫與關鍵字匹配推薦
- 安全規則攔截與孕期禁忌過濾
- Three.js 3D 頭部與人體模型預覽
- MediaPipe Face / Pose / Hand browser-side detection
- 相機不可用時的 3D/文字備援流程
- 完成頁與 localStorage 回饋紀錄
- Playwright 桌機、手機與相機拒絕 smoke test

目前屬於 Demo / Preview：

- RAG 是本機規則檢索 preview，尚未接完整 WHO / SymMap / CloudTCM 審核知識庫
- Gemma 4 E2B 只在本機大型模型檔存在且瀏覽器支援 WebGPU 時嘗試啟用
- AR 疊加是 Web 相機畫面上的概念展示，不宣稱醫療級或臨床級精準定位
- iOS ARKit、TrueDepth、LiDAR、SwiftData 與 LiteRT-LM 是企劃書中的正式版本方向

## 核心流程

1. 臉部美容 → 改善眼睛疲勞 → AI 推薦 → 3D 預覽 → AR Demo → 完成與回饋
2. 身體部位疼痛 → 肩頸痠痛 → 推薦穴位 → AR Demo → 完成
3. 調理身體 → 輸入脹氣相關症狀 → 安全審核 → RAG Demo → 校準 → 完成
4. 輸入高風險症狀 → 系統攔截 → 不顯示一般穴位推薦 → 顯示就醫提醒
5. 拒絕攝影機權限或攝影機不可用 → 自動切換 3D/文字備援 → 仍可完成流程

## 技術棧

- React 19
- TypeScript
- Vite
- Three.js
- MediaPipe Tasks Vision
- MediaPipe Tasks GenAI
- Lucide React
- Node test runner
- Playwright UI verification

## 專案結構

```text
AcuGuide/
├─ src/
│  ├─ components/          # UI、3D viewer、AR/camera panels、完成回饋
│  ├─ data/                # Demo 穴位、導引類型、預設目標資料
│  ├─ lib/                 # 推薦、安全規則、流程、回饋與 Gemma fallback
│  ├─ App.tsx
│  └─ styles.css
├─ public/
│  ├─ models/
│  │  ├─ head/             # Sketchfab 頭部模型與授權檔
│  │  ├─ human/            # Sketchfab 全身模型與授權檔
│  │  ├─ mediapipe/        # MediaPipe task models
│  │  └─ gemma/            # 本機 Gemma 模型放置位置，不直接上傳大型 .task
│  ├─ mediapipe/wasm/
│  └─ genai/wasm/
├─ scripts/
│  ├─ lint.mjs
│  ├─ run-tests.mjs
│  └─ verify-ui.mjs
├─ tests/
│  └─ domain.test.cjs
├─ ARCHITECTURE.md
├─ DEMO_SCRIPT.md
├─ CLAUDE_REVIEW_HANDOFF.md
├─ CLAUDE_REVIEW_REPORT.md
├─ claude-review-prompt.md
└─ package.json
```

## 開始使用

```bash
npm install
npm run dev
```

預設網址：

```text
http://127.0.0.1:5173/
```

Windows 也可以執行：

```text
start-local.bat
```

## 驗證指令

```bash
npm run typecheck
npm run lint
npm test
npm run test:ui
npm run build
npm run clean
```

`npm run clean` 會移除建置輸出、測試暫存、UI 截圖與根目錄日誌，不會刪除原始碼、模型或專案文件。

`npm run test:ui` 會啟動 Vite 測試伺服器，使用 Playwright 驗證桌機、手機、3D canvas 非空白、臉部流程、肩頸流程、脹氣校正流程、高風險攔截與相機拒絕備援。

## Gemma 模型

大型本機 LLM 模型不納入 GitHub。若要嘗試 Gemma 4 E2B Web 推論，請自行準備模型檔並放置：

```text
public/models/gemma/gemma-4-E2B-it-web.task
```

沒有模型檔時，Demo 仍會使用本機規則推薦與 RAG preview fallback，並在 UI 顯示 Gemma 不可用。

## 安全聲明

本作品是穴位學習、自我照護與競賽展示原型，不提供醫療診斷，不保證治療效果，也不能取代中醫師、醫師、物理治療師或其他專業醫療建議。若出現急性胸痛、呼吸困難、突發無力、視力異常、劇烈腹痛、皮膚破損、感染、孕期高風險或其他不適合自行按壓的情況，系統會提示停止操作並尋求專業協助。
