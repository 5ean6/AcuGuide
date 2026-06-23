# Claude Review Handoff

## Context

This repo is the competition Web Demo for 穴穴指教 AcuGuide. The source product plan is an iOS App with ARKit, Vision, LiDAR/TrueDepth, on-device Gemma 4 E2B and EmbeddingGemma RAG. This repo intentionally implements the browser demo layer only.

Primary acceptance source:

- `ACUGUIDE_COMPETITION_DEMO_TASK.md`
- `2026創客大賽企劃書-穴穴指教AcuGuide.pdf`

## What Changed

- Added safety rules for high-risk symptom blocking and pregnancy contraindication filtering.
- Added explicit Web Demo boundary copy.
- Added completion and localStorage feedback flow.
- Added A-D confidence text labels so state is not color-only.
- Added camera-denied fallback messaging.
- Added lazy loading for 3D, camera panels, calibration and Gemma recommender.
- Added `typecheck`, `lint`, `test` scripts.
- Added domain tests for safety, recommendation, pregnancy filtering, A-D labels, flow transitions and feedback storage.
- Expanded Playwright smoke test to cover desktop/mobile, high-risk block, calibration, completion feedback and camera fallback.

## Verification Run

All commands passed after fixes:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
```

Production build has no chunk warning after code splitting and `chunkSizeWarningLimit: 650`.

## Demo Paths To Recheck

1. Face: default face mode -> `黑眼圈` -> recommendation -> guide -> camera -> complete -> feedback.
2. Body: body mode -> `肩頸痠痛` -> recommendation -> guide -> complete.
3. Wellness: wellness mode -> `飯後脹氣 腹部悶` -> recommendation -> guide -> calibration -> complete.
4. Safety: `急性胸痛 呼吸困難` -> safety block -> no normal confirm button.
5. Camera fallback: reject `getUserMedia` -> camera panel shows 3D/text fallback -> complete still works.

## Files Most Worth Reviewing

- `src/App.tsx`
- `src/lib/safety.ts`
- `src/lib/recommender.ts`
- `src/lib/matcher.ts`
- `src/lib/feedback.ts`
- `src/components/GuidancePanel.tsx`
- `src/components/CompletionPanel.tsx`
- `src/components/FaceTrackingPanel.tsx`
- `src/components/BodyTrackingPanel.tsx`
- `scripts/verify-ui.mjs`
- `tests/domain.test.cjs`

## Review Priorities

1. Confirm high-risk safety block cannot proceed into normal acupoint guidance.
2. Confirm pregnancy filtering removes points whose caution text includes pregnancy warnings.
3. Confirm copy does not overclaim medical, clinical, AI or AR readiness.
4. Confirm camera streams and animation frames are cleaned up on unmount.
5. Confirm lazy loading did not break first-load 3D rendering.
6. Confirm localStorage failures do not break completion flow.
7. Confirm mobile layout does not cover the intent bar or model decision panel.

## Current Conclusion

Ready with minor risks. The demo is suitable for competition presentation, with the expected caveat that full iOS ARKit/Gemma/validated knowledge-base capabilities remain future implementation items.
