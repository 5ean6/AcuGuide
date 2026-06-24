import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { CompletionPanel } from "./components/CompletionPanel";
import { FeatureSelector } from "./components/FeatureSelector";
import { GuidancePanel } from "./components/GuidancePanel";
import { IntentBar } from "./components/IntentBar";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { SafetyAlertPanel } from "./components/SafetyAlertPanel";
import { featureModes, guideGoals } from "./data/acupoints";
import { getSymptomMarker } from "./data/symptomLocations";
import { nextDemoStage } from "./lib/demoFlow";
import {
  createFeedbackRecord,
  loadFeedbackRecords,
  saveFeedbackRecord,
} from "./lib/feedback";
import { recommendAcupoints } from "./lib/recommender";
import {
  applySafetyToRecommendation,
  createSafetyBlockedRecommendation,
  evaluateSafety,
  hasSafetyNotice,
  type SafetyAssessment,
} from "./lib/safety";
import type {
  AcupointRecommendation,
  AppStage,
  BodyRegionPick,
  CunCalibration,
  FeatureModeId,
  PointMatch,
} from "./types";

const defaultCalibration: CunCalibration = {
  pixelsPerCun: 64,
  palmSpanPx: 192,
  confidence: 0,
  method: "manual",
};

const defaultSafetyAssessment = evaluateSafety("");
const AnatomyViewer = lazy(() =>
  import("./components/AnatomyViewer").then((module) => ({
    default: module.AnatomyViewer,
  })),
);
const BodyTrackingPanel = lazy(() =>
  import("./components/BodyTrackingPanel").then((module) => ({
    default: module.BodyTrackingPanel,
  })),
);
const CalibrationStep = lazy(() =>
  import("./components/CalibrationStep").then((module) => ({
    default: module.CalibrationStep,
  })),
);
const FaceTrackingPanel = lazy(() =>
  import("./components/FaceTrackingPanel").then((module) => ({
    default: module.FaceTrackingPanel,
  })),
);

export default function App() {
  const [mode, setMode] = useState<FeatureModeId>("face");
  const [stage, setStage] = useState<AppStage>("select");
  const [intent, setIntent] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [submittedLabel, setSubmittedLabel] = useState("");
  const [calibration, setCalibration] = useState<CunCalibration>(defaultCalibration);
  const [selectedGoalId, setSelectedGoalId] = useState("face-eyelid-puffiness");
  const [previewGoalId, setPreviewGoalId] = useState("");
  const [selectedBodyRegion, setSelectedBodyRegion] = useState<BodyRegionPick | null>(
    null,
  );
  const [activePointId, setActivePointId] = useState("");
  const [isTargetContact, setIsTargetContact] = useState(false);
  const [submittedPoints, setSubmittedPoints] = useState<PointMatch[] | null>(null);
  const [submittedRecommendation, setSubmittedRecommendation] =
    useState<AcupointRecommendation | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [safetyAssessment, setSafetyAssessment] =
    useState<SafetyAssessment>(defaultSafetyAssessment);
  const [feedbackCount, setFeedbackCount] = useState(() => loadFeedbackRecords().length);

  const selectedMode = featureModes.find((item) => item.id === mode) ?? featureModes[0];
  const selectedGoal =
    guideGoals.find((goal) => goal.id === selectedGoalId && goal.mode === mode) ??
    guideGoals.find((goal) => goal.mode === mode);
  const previewGoal =
    stage === "select"
      ? guideGoals.find((goal) => goal.id === previewGoalId && goal.mode === mode)
      : undefined;
  const previewMode = previewGoal?.mode ?? mode;
  const previewModeInfo =
    featureModes.find((item) => item.id === previewMode) ?? selectedMode;
  const displayedGoal = previewGoal ?? selectedGoal;
  const modelSymptomMarker =
    mode === "other" && selectedBodyRegion
      ? {
          label: `${selectedBodyRegion.label}症狀位置`,
          position: selectedBodyRegion.position,
        }
      : getSymptomMarker(displayedGoal?.id);
  const typedIntent = intent.trim();
  const selectedBodyRegionQuery =
    stage === "select" && mode === "other" ? selectedBodyRegion?.query ?? "" : "";
  const awaitingOtherBodyPick =
    stage === "select" && mode === "other" && !selectedBodyRegion && !typedIntent;
  const activeQuery =
    stage === "guide"
      ? submittedQuery
      : previewGoal
        ? previewGoal.query
        : [
            selectedBodyRegionQuery,
            typedIntent || (selectedBodyRegion ? "" : displayedGoal?.query),
          ]
            .filter(Boolean)
            .join(" ");
  const { recommendation: localRecommendation, points: localPoints } = useMemo(
    () =>
      recommendAcupoints({
        mode: stage === "guide" ? mode : previewMode,
        query: activeQuery,
        fallbackGoalId: displayedGoal?.id,
      }),
    [activeQuery, displayedGoal?.id, mode, previewMode, stage],
  );
  const loadingRecommendation: AcupointRecommendation = {
    ...localRecommendation,
    summary: "Gemma 4 E2B 正在推薦穴位",
    engine: {
      llm: "Gemma 4 E2B",
      embedding: "EmbeddingGemma",
      status: "gemma_loading",
    },
  };
  const safetyBlocksRecommendation = safetyAssessment.severity === "block";
  const bodyPickPromptRecommendation: AcupointRecommendation = {
    mode: "other",
    query: "",
    confidence: 0.64,
    summary: "請先在 3D 人體上點選疼痛位置",
    engine: {
      llm: "Gemma 4 E2B",
      embedding: "EmbeddingGemma",
      status: "local_rag_preview",
    },
  };
  const recommendation =
    awaitingOtherBodyPick
      ? bodyPickPromptRecommendation
      : safetyBlocksRecommendation && submittedRecommendation
      ? submittedRecommendation
      : isRecommending && stage === "select"
      ? loadingRecommendation
      : stage === "select" && !previewGoal && submittedRecommendation
        ? submittedRecommendation
      : stage === "guide" && submittedRecommendation
        ? submittedRecommendation
        : localRecommendation;
  const previewPoints =
    awaitingOtherBodyPick || safetyBlocksRecommendation
      ? []
      : previewGoal || !submittedPoints
      ? localPoints
      : stage === "select" || stage === "guide" || stage === "complete"
        ? submittedPoints
        : localPoints;
  const activeId = previewGoal ? previewPoints[0]?.id : activePointId || previewPoints[0]?.id;
  const activePoint = previewPoints.find((point) => point.id === activeId) ?? previewPoints[0];
  const activePointIndex = Math.max(
    0,
    previewPoints.findIndex((point) => point.id === activeId),
  );
  const activeTargetLabel = activePoint
    ? `${activePoint.name} - ${activePoint.location}`
    : undefined;

  useEffect(() => {
    setIsTargetContact(false);
  }, [activeId, stage]);

  function handleModeChange(nextMode: FeatureModeId) {
    const nextGoal = guideGoals.find((goal) => goal.mode === nextMode);
    setMode(nextMode);
    setSelectedGoalId(nextGoal?.id ?? "");
    setPreviewGoalId("");
    setSelectedBodyRegion(null);
    setIntent("");
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
    setSafetyAssessment(defaultSafetyAssessment);
  }

  function handleGoalSelect(goalId: string) {
    const nextGoal = guideGoals.find((goal) => goal.id === goalId);
    if (!nextGoal) {
      return;
    }

    setMode(nextGoal.mode);
    setSelectedGoalId(nextGoal.id);
    setPreviewGoalId("");
    setSelectedBodyRegion(null);
    setIntent("");
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
    setSafetyAssessment(defaultSafetyAssessment);
  }

  function confirmPresetGoal(goalId = selectedGoal?.id ?? "") {
    const goal = guideGoals.find((item) => item.id === goalId);
    if (!goal) {
      return;
    }

    const fixedRecommendation = recommendAcupoints({
      mode: goal.mode,
      query: goal.query,
      fallbackGoalId: goal.id,
    });

    setSubmittedPoints(fixedRecommendation.points);
    setSubmittedRecommendation(fixedRecommendation.recommendation);
    setSubmittedQuery(goal.query);
    setSubmittedLabel(goal.label);
    setActivePointId(fixedRecommendation.points[0]?.id ?? "");
    setSafetyAssessment(defaultSafetyAssessment);
    setStage(nextDemoStage("select", "confirmRecommendation"));
  }

  function confirmPreviewedRecommendation() {
    if (isRecommending || safetyBlocksRecommendation || awaitingOtherBodyPick) {
      return;
    }

    if (submittedPoints && submittedRecommendation) {
      setStage(nextDemoStage("select", "confirmRecommendation"));
      return;
    }

    confirmPresetGoal();
  }

  function handleGoalPreview(goalId: string) {
    const nextGoal = guideGoals.find((goal) => goal.id === goalId);
    setPreviewGoalId(nextGoal?.mode === mode ? goalId : "");
  }

  function handleGoalPreviewEnd() {
    setPreviewGoalId("");
  }

  function handleIntentChange(value: string) {
    setIntent(value);
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
    setActivePointId("");
    if (mode === "other" && selectedBodyRegion) {
      const nextQuery = [selectedBodyRegion.query, value.trim()].filter(Boolean).join(" ");
      const nextSafety = evaluateSafety(nextQuery);
      setSafetyAssessment(nextSafety);
      if (nextSafety.severity === "block") {
        setSubmittedPoints([]);
        setSubmittedRecommendation(
          createSafetyBlockedRecommendation({
            mode,
            query: nextQuery,
            assessment: nextSafety,
          }),
        );
      }
      return;
    }

    setSafetyAssessment(defaultSafetyAssessment);
  }

  async function handleIntentSubmit() {
    const nextRegionQuery = mode === "other" ? selectedBodyRegion?.query ?? "" : "";
    const typedIntent = intent.trim();
    if (!typedIntent && !nextRegionQuery) {
      confirmPresetGoal();
      return;
    }

    const nextQuery = [nextRegionQuery, typedIntent].filter(Boolean).join(" ");
    const nextLabel =
      mode === "other" && selectedBodyRegion
        ? [selectedBodyRegion.label, typedIntent].filter(Boolean).join(" - ")
        : typedIntent;
    const preliminarySafety = evaluateSafety(nextQuery);

    if (preliminarySafety.severity === "block") {
      const blockedRecommendation = createSafetyBlockedRecommendation({
        mode,
        query: nextQuery,
        assessment: preliminarySafety,
      });
      setPreviewGoalId("");
      setSubmittedPoints([]);
      setSubmittedRecommendation(blockedRecommendation);
      setSubmittedQuery(nextQuery);
      setSubmittedLabel(nextLabel);
      setSafetyAssessment(preliminarySafety);
      setActivePointId("");
      return;
    }

    const fallback = recommendAcupoints({
      mode,
      query: nextQuery,
      fallbackGoalId: selectedGoal?.id,
    });
    let nextSafety = evaluateSafety(nextQuery, fallback.points);
    const safeFallback = applySafetyToRecommendation(fallback, nextSafety);
    let nextPoints = safeFallback.points;
    let nextRecommendation: AcupointRecommendation = safeFallback.recommendation;

    setIsRecommending(true);
    try {
      const { recommendAcupointsWithGemma } = await import("./lib/gemmaRecommender");
      const gemmaResult = await recommendAcupointsWithGemma({
        mode,
        query: nextQuery,
        fallbackGoalId: selectedGoal?.id,
      });
      nextSafety = evaluateSafety(nextQuery, gemmaResult.points);
      const safeGemma = applySafetyToRecommendation(gemmaResult, nextSafety);
      nextPoints = safeGemma.points;
      nextRecommendation = safeGemma.recommendation;
    } catch {
      nextRecommendation = {
        ...safeFallback.recommendation,
        summary: `${safeFallback.recommendation.summary}（Gemma 不可用，已用本機備援）`,
        engine: {
          llm: "Gemma 4 E2B",
          embedding: "EmbeddingGemma",
          status: "gemma_unavailable",
        },
      };
    } finally {
      setIsRecommending(false);
    }

    setPreviewGoalId("");
    setSubmittedPoints(nextPoints);
    setSubmittedRecommendation(nextRecommendation);
    setSubmittedQuery(nextQuery);
    setSubmittedLabel(nextLabel);
    setSafetyAssessment(nextSafety);
    setActivePointId(nextPoints[0]?.id ?? "");
  }

  function handleCalibrationDone() {
    setStage(nextDemoStage("calibrate", "finishCalibration"));
  }

  function handleRestart() {
    setStage(nextDemoStage(stage, "restart"));
    setIntent("");
    setSubmittedQuery("");
    setSubmittedLabel("");
    setSelectedBodyRegion(null);
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
    setSafetyAssessment(defaultSafetyAssessment);
  }

  function handleCompleteGuide() {
    setStage(nextDemoStage("guide", "completeGuide"));
  }

  function handleGuidePointSelect(pointId: string) {
    setActivePointId(pointId);
  }

  function selectAdjacentGuidePoint(direction: -1 | 1) {
    if (!previewPoints.length) {
      return;
    }

    const nextIndex =
      (activePointIndex + direction + previewPoints.length) % previewPoints.length;
    handleGuidePointSelect(previewPoints[nextIndex].id);
  }

  function handleFeedbackSave(rating: number, note: string) {
    const saved = saveFeedbackRecord(
      createFeedbackRecord({
        mode,
        query: submittedLabel || submittedQuery,
        points: previewPoints,
        rating,
        note,
      }),
    );

    if (saved) {
      setFeedbackCount(loadFeedbackRecords().length);
    }

    return saved;
  }

  function handleBodyRegionSelect(region: BodyRegionPick) {
    const nextQuery = [region.query, intent.trim()].filter(Boolean).join(" ");
    const nextSafety = evaluateSafety(nextQuery);

    setMode("other");
    setSelectedGoalId("other-model-pick");
    setSelectedBodyRegion(region);
    setPreviewGoalId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
    setSubmittedQuery("");
    setSubmittedLabel("");
    setActivePointId("");
    setSafetyAssessment(nextSafety);

    if (nextSafety.severity === "block") {
      setSubmittedPoints([]);
      setSubmittedRecommendation(
        createSafetyBlockedRecommendation({
          mode: "other",
          query: nextQuery,
          assessment: nextSafety,
        }),
      );
    }
  }

  return (
    <div className={`app app-${stage}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="AcuGuide 首頁">
          <Activity size={21} strokeWidth={1.9} aria-hidden="true" />
          AcuGuide
        </a>
        <div className="stage-pill">
          <SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
          {selectedMode.compactTitle}
        </div>
      </header>

      {stage === "calibrate" ? (
        <Suspense fallback={<ModuleFallback label="校正模組載入中" />}>
          <CalibrationStep
            calibration={calibration}
            onCalibrationChange={setCalibration}
            onBack={() => setStage("select")}
            onDone={handleCalibrationDone}
          />
        </Suspense>
      ) : null}

      {stage === "select" ? (
        <main className="select-layout">
          <section className="control-surface" aria-labelledby="mode-title">
            <p className="eyebrow">Mode</p>
            <h1 id="mode-title">選擇導引類型</h1>
            <div className="demo-boundary" data-testid="demo-boundary">
              <strong>Web Demo 邊界</strong>
              <span>
                3D 與 MediaPipe 在瀏覽器本機執行；RAG 為本機規則預覽；Gemma 與
                ARKit 精準定位屬 iOS 後續版本。
              </span>
            </div>
            <FeatureSelector
              value={mode}
              selectedGoalId={selectedGoal?.id}
              previewGoalId={previewGoalId}
              onChange={handleModeChange}
              onGoalSelect={handleGoalSelect}
              onGoalPreview={handleGoalPreview}
              onGoalPreviewEnd={handleGoalPreviewEnd}
            />
          </section>

          <section
            className={`model-surface ${awaitingOtherBodyPick ? "is-picking-body-region" : ""}`}
            aria-label={`${previewModeInfo.title}模型`}
          >
            <div className="surface-label">
              <span>{previewModeInfo.title}</span>
              <small
                data-testid={mode === "other" ? "selected-body-region" : undefined}
                data-region-id={selectedBodyRegion?.id ?? ""}
              >
                {mode === "other" && selectedBodyRegion
                  ? `${selectedBodyRegion.label} 已選取`
                  : displayedGoal?.label ?? previewModeInfo.meta}
              </small>
            </div>
            <Suspense fallback={<ViewerFallback />}>
              <AnatomyViewer
                mode={previewMode}
                points={previewPoints}
                activePointId={activeId}
                focusPointId={previewGoal ? activeId : undefined}
                symptomMarker={modelSymptomMarker}
                focusSymptomMarker
                regionSelectionEnabled={mode === "other" && stage === "select"}
                onPointSelect={setActivePointId}
                onBodyRegionSelect={handleBodyRegionSelect}
              />
            </Suspense>
            <div className="model-decision-panel">
              {hasSafetyNotice(safetyAssessment) ? (
                <SafetyAlertPanel assessment={safetyAssessment} />
              ) : null}
              {!safetyBlocksRecommendation ? (
                <>
                  <RecommendationPanel
                    recommendation={recommendation}
                    points={previewPoints}
                    variant="inline"
                  />
                  <button
                    className="primary-action model-confirm-action"
                    type="button"
                    onClick={confirmPreviewedRecommendation}
                    disabled={isRecommending || awaitingOtherBodyPick}
                    data-testid="model-confirm"
                  >
                    <span>
                      {awaitingOtherBodyPick
                        ? "先點選部位"
                        : submittedRecommendation && !previewGoal
                          ? "確認推薦"
                          : "確認這組穴位"}
                    </span>
                    <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </main>
      ) : null}

      {stage === "guide" ? (
        <main className="guide-layout guide-layout-ar">
          <section className="guide-ar-surface" aria-label="AR 輔助定位">
            <Suspense fallback={<ModuleFallback label="AR 模組載入中" />}>
              {mode === "face" ? (
                <FaceTrackingPanel
                  targetPointId={activePoint?.id}
                  targetLabel={activeTargetLabel}
                  onTargetContactChange={setIsTargetContact}
                />
              ) : (
                <BodyTrackingPanel
                  targetPointId={activePoint?.id}
                  targetLabel={activeTargetLabel}
                  onTargetContactChange={setIsTargetContact}
                />
              )}
            </Suspense>
            {activePoint ? (
              <nav className="ar-point-switcher" aria-label="切換目前穴位">
                <button
                  type="button"
                  onClick={() => selectAdjacentGuidePoint(-1)}
                  aria-label="上一個穴位"
                  data-testid="previous-guide-point"
                >
                  <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                </button>
                <div aria-live="polite">
                  <span>
                    {activePointIndex + 1} / {previewPoints.length}
                  </span>
                  <strong data-testid="active-ar-point-name">{activePoint.name}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => selectAdjacentGuidePoint(1)}
                  aria-label="下一個穴位"
                  data-testid="next-guide-point"
                >
                  <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </nav>
            ) : null}
          </section>
          <GuidancePanel
            points={previewPoints}
            activePointId={activeId}
            calibration={calibration}
            query={submittedLabel}
            targetContact={isTargetContact}
            recommendation={recommendation}
            onSelectPoint={handleGuidePointSelect}
            onRestart={handleRestart}
            onCalibrate={() => setStage(nextDemoStage("guide", "requestCalibration"))}
            onComplete={handleCompleteGuide}
            modelPreview={
              <div className="panel-model-preview" aria-label="3D 模型參考">
                <div className="surface-label">
                  <span>{selectedMode.title}</span>
                  <small>{selectedMode.meta}</small>
                </div>
                <Suspense fallback={<ViewerFallback />}>
                  <AnatomyViewer
                    mode={mode}
                    points={previewPoints}
                    activePointId={activeId}
                    focusPointId={activeId}
                    autoRotate={false}
                    onPointSelect={handleGuidePointSelect}
                  />
                </Suspense>
              </div>
            }
          />
        </main>
      ) : null}

      {stage === "complete" ? (
        <CompletionPanel
          mode={selectedMode}
          query={submittedLabel || submittedQuery}
          points={previewPoints}
          recommendation={submittedRecommendation}
          feedbackCount={feedbackCount}
          onSaveFeedback={handleFeedbackSave}
          onRestart={handleRestart}
        />
      ) : null}

      {stage === "select" ? (
        <IntentBar
          value={intent}
          placeholder={selectedMode.placeholder}
          actionLabel={
            isRecommending ? "Gemma 推薦中" : intent.trim() ? "取得推薦" : "確認選項"
          }
          disabled={isRecommending}
          onChange={handleIntentChange}
          onSubmit={handleIntentSubmit}
        />
      ) : null}
    </div>
  );
}

function ViewerFallback() {
  return (
    <div className="viewer-loading" role="status">
      3D 模型載入中
    </div>
  );
}

function ModuleFallback({ label }: { label: string }) {
  return (
    <div className="module-loading" role="status">
      {label}
    </div>
  );
}
