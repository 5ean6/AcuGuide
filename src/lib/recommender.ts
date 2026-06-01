import { guideGoals } from "../data/acupoints";
import type { AcupointRecommendation, FeatureModeId, PointMatch } from "../types";
import { matchGuidePoints } from "./matcher";

type RecommendationInput = {
  mode: FeatureModeId;
  query: string;
  fallbackGoalId?: string;
};

type RecommendationResult = {
  recommendation: AcupointRecommendation;
  points: PointMatch[];
};

export function recommendAcupoints({
  mode,
  query,
  fallbackGoalId,
}: RecommendationInput): RecommendationResult {
  const fallbackGoal =
    guideGoals.find((goal) => goal.id === fallbackGoalId && goal.mode === mode) ??
    guideGoals.find((goal) => goal.mode === mode);
  const normalizedQuery = query.trim() || fallbackGoal?.query || "";
  const points = matchGuidePoints(mode, normalizedQuery).slice(0, 4);
  const topScore = points[0]?.score ?? 0;
  const confidence = Math.max(0.48, Math.min(0.92, 0.52 + topScore / 28));

  return {
    recommendation: {
      mode,
      query: normalizedQuery,
      confidence,
      summary: buildRecommendationSummary(points, normalizedQuery),
      engine: {
        llm: "Gemma 4 E2B",
        embedding: "EmbeddingGemma",
        status: "local_rag_preview",
      },
    },
    points,
  };
}

function buildRecommendationSummary(points: PointMatch[], query: string) {
  if (!points.length) {
    return "暫無推薦穴位";
  }

  const names = points
    .slice(0, 3)
    .map((point) => point.name)
    .join("、");
  return query.trim() ? `推薦先按 ${names}` : `預設推薦 ${names}`;
}
