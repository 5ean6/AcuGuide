# Claude Review Report

更新日期：2026-06-23

## 1. 審查摘要

AcuGuide Web Demo 已完成競賽展示所需的主要操作閉環，包含安全分流、穴位推薦、3D 模型、MediaPipe 臉部/姿勢/手部追蹤、AR 穴位切換、按壓倒數、方向動畫、完成與本機回饋。

## 2. 實際執行指令

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
```

## 3. Type Check 結果

通過。TypeScript project references 無錯誤。

## 4. Lint 結果

通過。未發現 browser source console、explicit `any`、負 letter-spacing 或規則禁止的醫療宣稱。

## 5. Test 結果

10 項 domain tests 全部通過，涵蓋：高風險阻擋、肩頸推薦、腰背排序、3D 身體部位選擇、按壓時間與方向、孕期禁忌過濾、A-D 信心標示、流程狀態與 localStorage 回饋。

## 6. Production Build 結果

通過。Vite 完成 production bundle，3D viewer、MediaPipe panels 與 Gemma recommender 維持 lazy/dynamic chunks。

## 7. Demo 流程驗證

Playwright 已驗證桌機 1440 x 900、手機 390 x 844、3D canvas、臉部流程、身體流程、其他部位直接點模型、調理流程、校正、相機拒絕備援、AR 下一穴位與按壓倒數。

## 8. 已修正的重要問題

- AR camera loop 改為讀取最新 target ref，切換穴位不再停留第一點。
- 右上 3D 模型固定朝向目前穴位。
- 手指接近穴位時提供變色、放大、畫面回饋與倒數。
- 按法可顯示定點、畫圓、向外、向上與向下動畫。
- 高風險症狀與胸口選擇會先顯示安全提示。

## 9. 主要新增模組

- `src/components/PressureCoach.tsx`
- `src/components/CompletionPanel.tsx`
- `src/components/SafetyAlertPanel.tsx`
- `src/lib/bodyRegions.ts`
- `src/lib/pressGuidance.ts`
- `src/lib/safety.ts`
- `src/lib/feedback.ts`

## 10. 已知限制

- Web Demo 的手部接觸為 2D 螢幕距離判斷，不能量測真實按壓力道。
- C/D 級穴位仍以 3D 與文字指引為主。
- Gemma task model 未納入 Git 時會使用本機規則/RAG preview fallback。

## 11. 展示環境建議

使用最新版 Chrome 或 Edge，建議 1920 x 1080。首次啟動相機需允許權限；相機不可用時仍可走 3D/文字與按住模擬流程。

## 12. Demo 邊界

本作品是穴位學習、自我照護與競賽展示原型，不提供診斷，也不能取代醫療專業人員。ARKit、LiDAR、TrueDepth、正式裝置端 Gemma 與完整專家審核知識庫屬後續 iOS 版本。

## 13. 資料夾整理結果

保留原始碼、模型、WASM、競賽規格與必要交接文件；移除舊計畫、生成物與日誌。新增 `npm run clean`，並讓測試成功後自動清理暫存資料。

## 14. 最終結論

Ready for competition demo。核心流程、測試、build 與 fallback 均可執行；正式醫療資料與 iOS 精準 AR 仍需後續專家及裝置驗證。
