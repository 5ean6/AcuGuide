# Claude Review Prompt

You are reviewing the AcuGuide competition Web Demo as a senior code reviewer, QA engineer and product acceptance reviewer.

Please read:

1. `ACUGUIDE_COMPETITION_DEMO_TASK.md`
2. `2026創客大賽企劃書-穴穴指教AcuGuide.pdf`
3. `README.md`
4. `ARCHITECTURE.md`
5. `DEMO_SCRIPT.md`
6. `CLAUDE_REVIEW_HANDOFF.md`
7. `package.json`
8. All source files changed for this demo

Then actually run:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
```

Review these flows manually or with Playwright:

1. Face beauty -> improve eye fatigue / black circles -> AI recommendation -> 3D preview -> AR Demo -> completion feedback.
2. Body pain -> shoulder and neck soreness -> recommended points -> AR Demo -> completion.
3. Wellness -> bloating symptom input -> safety review -> RAG Demo -> calibration -> completion.
4. High-risk symptom input such as `急性胸痛 呼吸困難` -> safety block -> no normal acupoint recommendation.
5. Camera permission denied or unavailable -> fallback Demo -> completion still possible.

Prioritize bugs and risks over stylistic suggestions:

- TypeScript errors
- Build warnings
- Broken UI flows
- Fake or misleading interactions
- Overclaiming medical, clinical, AI or AR capability
- Camera resource leaks
- Timer or animation frame leaks
- localStorage failure handling
- Mobile layout overlap
- Accessibility regressions
- Missing safety rules

Do not rewrite the whole project unless it is impossible to repair. Directly fix high- and medium-priority issues that are clearly correct to fix.

Final output should include a clear readiness conclusion:

- Ready for competition demo
- Ready with minor risks
- Not ready
