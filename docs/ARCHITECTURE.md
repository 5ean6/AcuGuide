# AcuGuide 系統架構 / Architecture

## 技術組成

- React 19、TypeScript、Vite
- Three.js 與 GLTFLoader：3D 人體模型
- MediaPipe Tasks Vision：臉部、姿勢與手部偵測
- MediaPipe Tasks GenAI：選用的 Gemma 瀏覽器推論
- localStorage：展示完成紀錄
- Node test runner 與 Playwright：邏輯與 UI 驗證

## 主要流程

```text
引導類型或 3D 身體部位
  -> 症狀與目標
  -> 安全規則
  -> 本機穴位比對 / Gemma 選用推論
  -> 3D 穴位預覽
  -> MediaPipe AR 引導
  -> 接觸、倒數、方向與音效回饋
  -> 完成紀錄
```

## 程式結構

- `src/components/`：頁面區塊、3D viewer、相機與 AR 面板
- `src/data/`：穴位與展示資料
- `src/lib/`：推薦、安全規則、追蹤及 Gemma fallback
- `public/models/`：3D、MediaPipe 與本機 Gemma 模型
- `tests/`：領域邏輯測試
- `scripts/`：lint、測試、UI 驗證及清理工具

## 隱私與限制

相機影像在瀏覽器本機交由 MediaPipe 處理，不由此 Demo 上傳。瀏覽器定位屬概念驗證；正式行動版仍需 ARKit、裝置感測器、臨床資料校正與更完整的安全驗證。

## English Summary

AcuGuide uses React and Three.js for the interface and anatomy views, MediaPipe for local face, pose, and hand tracking, and an optional Gemma task model for browser-side inference. Recommendations pass through local matching and safety rules before the AR coaching flow provides contact and timing feedback.
