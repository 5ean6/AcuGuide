import { useMemo, useState } from "react";
import { Activity, ArrowRight, SlidersHorizontal } from "lucide-react";
import { AnatomyViewer } from "./components/AnatomyViewer";
import { BodyTrackingPanel } from "./components/BodyTrackingPanel";
import { CalibrationStep } from "./components/CalibrationStep";
import { FaceTrackingPanel } from "./components/FaceTrackingPanel";
import { FeatureSelector } from "./components/FeatureSelector";
import { GuidancePanel } from "./components/GuidancePanel";
import { IntentBar } from "./components/IntentBar";
import { RecommendationPanel } from "./components/RecommendationPanel";
import { featureModes, guideGoals } from "./data/acupoints";
import { recommendAcupointsWithGemma } from "./lib/gemmaRecommender";
import { recommendAcupoints } from "./lib/recommender";
import type {
  AcupointRecommendation,
  AppStage,
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

export default function App() {
  const [mode, setMode] = useState<FeatureModeId>("face");
  const [stage, setStage] = useState<AppStage>("select");
  const [intent, setIntent] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [submittedLabel, setSubmittedLabel] = useState("");
  const [calibration, setCalibration] = useState<CunCalibration>(defaultCalibration);
  const [selectedGoalId, setSelectedGoalId] = useState("face-eyelid-puffiness");
  const [previewGoalId, setPreviewGoalId] = useState("");
  const [activePointId, setActivePointId] = useState("");
  const [submittedPoints, setSubmittedPoints] = useState<PointMatch[] | null>(null);
  const [submittedRecommendation, setSubmittedRecommendation] =
    useState<AcupointRecommendation | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);

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
  const activeQuery =
    stage === "guide"
      ? submittedQuery
      : previewGoal
        ? previewGoal.query
        : intent.trim() || displayedGoal?.query || "";
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
  const recommendation =
    isRecommending && stage === "select"
      ? loadingRecommendation
      : stage === "select" && !previewGoal && submittedRecommendation
        ? submittedRecommendation
      : stage === "guide" && submittedRecommendation
        ? submittedRecommendation
        : localRecommendation;
  const previewPoints =
    previewGoal || !submittedPoints
      ? localPoints
      : stage === "select" || stage === "guide"
        ? submittedPoints
        : localPoints;
  const activeId = previewGoal ? previewPoints[0]?.id : activePointId || previewPoints[0]?.id;
  const activePoint = previewPoints.find((point) => point.id === activeId) ?? previewPoints[0];
  const activePointSupportsAr = Boolean(activePoint?.ar.enabled);
  const activeTargetLabel = activePoint
    ? `${activePoint.name} - ${activePoint.location} · AR ${activePoint.ar.confidence}${
        activePointSupportsAr ? "" : "（先用 3D 指引）"
      }`
    : undefined;

  function handleModeChange(nextMode: FeatureModeId) {
    const nextGoal = guideGoals.find((goal) => goal.mode === nextMode);
    setMode(nextMode);
    setSelectedGoalId(nextGoal?.id ?? "");
    setPreviewGoalId("");
    setIntent("");
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
  }

  function handleGoalSelect(goalId: string) {
    const nextGoal = guideGoals.find((goal) => goal.id === goalId);
    if (!nextGoal) {
      return;
    }

    setMode(nextGoal.mode);
    setSelectedGoalId(nextGoal.id);
    setPreviewGoalId("");
    setIntent("");
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
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
    setStage("guide");
  }

  function confirmPreviewedRecommendation() {
    if (isRecommending) {
      return;
    }

    if (submittedPoints && submittedRecommendation) {
      setStage("guide");
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
  }

  async function handleIntentSubmit() {
    const typedIntent = intent.trim();
    if (!typedIntent) {
      confirmPresetGoal();
      return;
    }

    const nextQuery = typedIntent;
    const nextLabel = typedIntent;
    const fallback = recommendAcupoints({
      mode,
      query: nextQuery,
      fallbackGoalId: selectedGoal?.id,
    });
    let nextPoints = fallback.points;
    let nextRecommendation: AcupointRecommendation = fallback.recommendation;

    setIsRecommending(true);
    try {
      const gemmaResult = await recommendAcupointsWithGemma({
        mode,
        query: nextQuery,
        fallbackGoalId: selectedGoal?.id,
      });
      nextPoints = gemmaResult.points;
      nextRecommendation = gemmaResult.recommendation;
    } catch {
      nextRecommendation = {
        ...fallback.recommendation,
        summary: `${fallback.recommendation.summary}（Gemma 不可用，已用本機備援）`,
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
    setActivePointId(nextPoints[0]?.id ?? "");
  }

  function handleCalibrationDone() {
    setStage("guide");
  }

  function handleRestart() {
    setStage("select");
    setActivePointId("");
    setSubmittedPoints(null);
    setSubmittedRecommendation(null);
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
        <CalibrationStep
          calibration={calibration}
          onCalibrationChange={setCalibration}
          onBack={() => setStage("select")}
          onDone={handleCalibrationDone}
        />
      ) : null}

      {stage === "select" ? (
        <main className="select-layout">
          <section className="control-surface" aria-labelledby="mode-title">
            <p className="eyebrow">Mode</p>
            <h1 id="mode-title">選擇導引類型</h1>
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

          <section className="model-surface" aria-label={`${previewModeInfo.title}模型`}>
            <div className="surface-label">
              <span>{previewModeInfo.title}</span>
              <small>{displayedGoal?.label ?? previewModeInfo.meta}</small>
            </div>
            <AnatomyViewer
              mode={previewMode}
              points={previewPoints}
              activePointId={activeId}
              focusPointId={previewGoal ? activeId : undefined}
              onPointSelect={setActivePointId}
            />
            <div className="model-decision-panel">
              <RecommendationPanel
                recommendation={recommendation}
                points={previewPoints}
                variant="inline"
              />
              <button
                className="primary-action model-confirm-action"
                type="button"
                onClick={confirmPreviewedRecommendation}
                disabled={isRecommending}
                data-testid="model-confirm"
              >
                <span>
                  {submittedRecommendation && !previewGoal ? "確認推薦" : "確認這組穴位"}
                </span>
                <ArrowRight size={17} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </section>
        </main>
      ) : null}

      {stage === "guide" ? (
        <main className="guide-layout guide-layout-ar">
          <section className="guide-ar-surface" aria-label="AR 輔助定位">
          {mode === "face" ? (
              <FaceTrackingPanel
                targetPointId={activePointSupportsAr ? activePoint?.id : undefined}
                targetLabel={activeTargetLabel}
              />
          ) : (
              <BodyTrackingPanel
                targetPointId={activePointSupportsAr ? activePoint?.id : undefined}
                targetLabel={activeTargetLabel}
              />
          )}
          </section>
          <GuidancePanel
            points={previewPoints}
            activePointId={activeId}
            calibration={calibration}
            query={submittedLabel}
            recommendation={recommendation}
            onSelectPoint={setActivePointId}
            onRestart={handleRestart}
            onCalibrate={() => setStage("calibrate")}
            modelPreview={
                <div className="panel-model-preview" aria-label="3D 模型參考">
                  <div className="surface-label">
                    <span>{selectedMode.title}</span>
                    <small>{selectedMode.meta}</small>
                  </div>
                  <AnatomyViewer
                    mode={mode}
                    points={previewPoints}
                    activePointId={activeId}
                    onPointSelect={setActivePointId}
                  />
                </div>
            }
          />
        </main>
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
