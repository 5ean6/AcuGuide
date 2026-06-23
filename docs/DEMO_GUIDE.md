# AcuGuide 競賽展示指南 / Demo Guide

## 展示前準備

1. 執行 `npm run dev`，使用最新版 Chrome 或 Edge 開啟 `http://127.0.0.1:5173/`。
2. 確認相機權限、3D 模型及 MediaPipe 模型可正常載入。
3. 展示前執行 `npm run test:ui`，確認主要流程與畫面無誤。

## 建議展示流程

1. 在首頁說明 AcuGuide 將症狀輸入、3D 人體定位與 AR 穴位引導整合在同一流程。
2. 選擇「身體部位疼痛」，旋轉人體並直接點選疼痛部位。
3. 輸入症狀或目標，確認系統建議的穴位與安全提醒。
4. 進入穴位指引，展示 3D 位置與上一個／下一個穴位切換。
5. 開啟相機，讓手部接近目標穴位，展示變色放大、按壓倒數、方向提示與音效。
6. 完成引導並顯示紀錄與回饋。

## 備援方式

- 無法使用相機時，使用 3D 指引與校正控制完成流程。
- WebGPU 或 Gemma 模型不可用時，系統會回退到本機規則式推薦。
- 現場網路不穩時，請事先完成 `npm install` 並確認模型已存於 `public/models/`。

## Presenter Notes (English)

Demonstrate the complete path from direct body selection and symptom input to acupoint recommendation and AR coaching. Emphasize that hand contact, timing, motion cues, and audio feedback run locally in the browser. Clearly identify browser AR and AI recommendations as competition-demo capabilities rather than clinical-grade positioning or diagnosis.
