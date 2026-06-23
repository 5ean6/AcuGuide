import { Sparkles } from "lucide-react";
import type { AcupointRecommendation, PointMatch } from "../types";

type RecommendationPanelProps = {
  recommendation: AcupointRecommendation;
  points: PointMatch[];
  variant?: "floating" | "inline";
};

export function RecommendationPanel({
  recommendation,
  points,
  variant = "inline",
}: RecommendationPanelProps) {
  const engineLabel = engineStatusLabel(recommendation.engine.status);

  return (
    <section
      className={`recommendation-panel recommendation-panel-${variant}`}
      aria-label="推薦穴位"
      data-testid="recommendation-panel"
    >
      <div className="recommendation-head">
        <span className="recommendation-kicker">
          <Sparkles size={14} strokeWidth={1.9} aria-hidden="true" />
          {engineLabel}
        </span>
        <span>{Math.round(recommendation.confidence * 100)}%</span>
      </div>
      <strong>{recommendation.summary}</strong>
      <div className="recommendation-points" role="list">
        {points.slice(0, 4).map((point, index) => (
          <span key={point.id} role="listitem">
            {index + 1}. {point.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function engineStatusLabel(status: AcupointRecommendation["engine"]["status"]) {
  if (status === "gemma_loading") {
    return "Gemma 載入中";
  }

  if (status === "gemma4_web") {
    return "Gemma 4";
  }

  if (status === "gemma_unavailable") {
    return "本機備援";
  }

  if (status === "safety_blocked") {
    return "安全攔截";
  }

  return "RAG";
}
