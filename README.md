# AcuGuide 穴穴指教

[中文](#中文) | [English](#english) | [架構文件](docs/ARCHITECTURE.md) | [展示指南](docs/DEMO_GUIDE.md) | [企劃書 PDF](docs/2026創客大賽企劃書-穴穴指教AcuGuide.pdf)

## 中文

AcuGuide 是以穴位引導為核心的互動式 Web Demo。使用者可選擇臉部美容、身體部位疼痛、調理身體，或直接在 3D 人體模型上標記不適部位，再搭配症狀與目標取得穴位建議。

### 主要功能

- 可旋轉的臉部與全身 3D 人體模型
- 直接點選人體部位，不必逐項翻找選單
- MediaPipe 臉部、姿勢與手部追蹤
- AR 穴位前後切換與固定位置指引
- 手部接觸回饋、按壓倒數、方向動畫與音效
- 本機規則式 RAG 預覽與選用的 Gemma Web 模型
- 安全提醒、校正流程與完成紀錄

### 快速開始

```bash
npm install
npm run dev
```

開啟 `http://127.0.0.1:5173/`。Windows 也可執行 `start-local.bat`。

### 驗證指令

```bash
npm run typecheck
npm run lint
npm test
npm run verify:geometry
npm run test:ui
npm run build
npm run clean
```

### 文件

- [系統架構](docs/ARCHITECTURE.md)
- [競賽展示指南](docs/DEMO_GUIDE.md)
- [Gemma 模型設定](docs/GEMMA_MODEL.md)
- [2026 創客大賽企劃書](docs/2026創客大賽企劃書-穴穴指教AcuGuide.pdf)

### Demo 範圍

目前的 RAG 與 Gemma 為展示用途；瀏覽器 AR 是 MediaPipe 概念驗證，不等同於正式 iOS 版的 ARKit、TrueDepth 或 LiDAR 定位。本產品不取代醫療診斷。

### GitHub Pages 部署

推送至 `main` 後，`.github/workflows/deploy-pages.yml` 會自動驗證、建置並部署：

```text
https://5ean6.github.io/AcuGuide/
```

請在 GitHub repository 的 `Settings > Pages > Build and deployment` 將 Source 設為 `GitHub Actions`。production 部署會排除 Gemma 大型模型並立即使用本機規則推薦；3D、MediaPipe 與相機功能仍會保留。

## English

AcuGuide is an interactive web demo for acupoint guidance. Users can choose facial care, body pain, wellness, or select an uncomfortable area directly on a rotatable 3D body, then enter symptoms and goals to receive suggested acupoints.

### Highlights

- Rotatable face and full-body 3D models
- Direct body-part selection on the model
- MediaPipe face, pose, and hand tracking
- Previous/next AR acupoint navigation with a fixed target guide
- Contact feedback, pressure countdowns, direction cues, and sound
- Local rule-based RAG preview with optional Gemma web inference
- Safety notices, calibration, and completion history

### Quick Start

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

### Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Competition Demo Guide](docs/DEMO_GUIDE.md)
- [Gemma Model Setup](docs/GEMMA_MODEL.md)
- [Product Proposal PDF (Chinese)](docs/2026創客大賽企劃書-穴穴指教AcuGuide.pdf)

### Demo Boundaries

RAG and Gemma integration are demonstration features. Browser AR is a MediaPipe proof of concept and does not represent production iOS ARKit, TrueDepth, or LiDAR accuracy. AcuGuide is not a substitute for medical diagnosis.

### GitHub Pages

Pushes to `main` are deployed by `.github/workflows/deploy-pages.yml` to `https://5ean6.github.io/AcuGuide/`. Set the repository Pages source to `GitHub Actions`. Production builds exclude the large Gemma model and use the local rule-based recommender immediately.

`npm run verify:geometry` loads the actual GLTF meshes and checks that every calibrated acupoint reaches its intended model surface.
