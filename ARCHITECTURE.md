# AcuGuide Architecture

## 產品目標

AcuGuide 將穴位知識、症狀推薦、3D 空間理解、AR 輔助定位與安全分流整合成一條自我照護導引流程。Web Demo 服務競賽展示，對應企劃書中的 iOS App 方向，但避免宣稱已完成正式醫療級 AI 或 AR 定位。

## Runtime

- UI：React 19 + TypeScript + Vite
- 3D：Three.js + GLTFLoader
- Vision：MediaPipe Tasks Vision browser runtime
- GenAI：MediaPipe Tasks GenAI，僅在本機 Gemma 模型存在且 WebGPU 可用時嘗試
- Testing：Node test runner + Playwright
- Storage：localStorage，僅儲存完成回饋

## 資料流

```text
User intent / preset goal
  -> safety rules
  -> local point matching
  -> optional Gemma 4 E2B attempt
  -> safety filter for pregnancy contraindications
  -> 3D model preview
  -> camera / AR concept panel
  -> optional calibration
  -> completion feedback in localStorage
```

## 模組

### `src/data/acupoints.ts`

Demo 穴位資料庫，包含三大模式、預設目標、位置文案、按法、禁忌、3D 座標、AR 信心等級與定位策略。資料源標示為 Demo 初始資料或使用者提供美容穴位資料，尚未宣稱完整 WHO / SymMap 審核。

### `src/lib/matcher.ts` 與 `src/lib/recommender.ts`

以 tags、effects、location 與 query 做本機關鍵字匹配，回傳最多四個候選穴位。這是 Web Demo 的 RAG preview fallback，不是正式 EmbeddingGemma 混合檢索。

### `src/lib/safety.ts`

前置安全規則層。高風險急症如胸痛、呼吸困難、突發無力、劇烈腹痛、眼部異常、皮膚破損會直接 block，不進入一般推薦。孕期描述會保留流程，但移除資料中標示孕期避免自行按壓的候選穴位。

### `src/lib/gemmaRecommender.ts`

動態載入的 Gemma 4 E2B 嘗試路徑。輸出空間限定於知識庫候選穴位 id；若 WebGPU、模型或 runtime 不可用，App 會回到本機推薦。

### `src/components/AnatomyViewer.tsx`

Three.js 3D 頭部/人體模型預覽。模型載入失敗時使用幾何 fallback，避免白屏。此元件以 lazy chunk 載入，降低初始 bundle。

### `src/components/FaceTrackingPanel.tsx`

MediaPipe Face Landmarker 相機概念展示，將臉部 landmark 畫到 canvas，並依候選穴位顯示目標區域。相機拒絕或不可用時顯示 3D/文字備援。

### `src/components/BodyTrackingPanel.tsx`

MediaPipe Pose + Face + Hand 的 holistic 概念展示，支援合谷、內關、曲池、足三里等可由關鍵點粗估的目標點。對 D 級或不可穩定定位的穴位保留 3D 指引。

### `src/components/CalibrationStep.tsx`

手部比例尺校正。相機可用時以 Hand Landmarker 估算四指寬；不可用時可用 slider 手動微調。

### `src/components/CompletionPanel.tsx`

完成與回饋頁。回饋資料僅寫入 localStorage，包含模式、query、point ids、AR confidence grades、rating 與 note。

## Privacy

Web Demo 不上傳影像。相機 frame 僅在瀏覽器端用於 MediaPipe 偵測與 canvas 繪製。症狀輸入不送出遠端服務；localStorage 僅保留使用者主動儲存的完成回饋。

## Code Splitting

`AnatomyViewer`、相機追蹤面板、校正面板與 Gemma recommender 均採 lazy/dynamic import。Production build 的主入口約 229KB，3D viewer 以獨立 chunk 載入。

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:ui`
- `npm run build`

`test:ui` 會驗證桌機、手機、3D canvas、臉部流程、肩頸流程、脹氣校正流程、高風險攔截與相機拒絕備援。

## Known Limits

- Web 相機 AR 為概念展示，不是正式 ARKit world tracking。
- Gemma 模型檔不在 repo，現場通常走本機 fallback。
- Demo 穴位資料未達正式醫療或臨床審核等級。
- C/D 級穴位以 3D 與文字為主，不強行疊 AR 點。
