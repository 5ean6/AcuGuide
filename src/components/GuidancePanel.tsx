import { ArrowLeft, LocateFixed, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { safetyNote } from "../data/acupoints";
import type { AcupointRecommendation, CunCalibration, PointMatch } from "../types";
import { RecommendationPanel } from "./RecommendationPanel";

type GuidancePanelProps = {
  points: PointMatch[];
  activePointId: string;
  calibration: CunCalibration;
  query: string;
  onSelectPoint: (id: string) => void;
  onRestart: () => void;
  onCalibrate: () => void;
  modelPreview?: ReactNode;
  recommendation?: AcupointRecommendation;
};

export function GuidancePanel({
  points,
  activePointId,
  calibration,
  query,
  onSelectPoint,
  onRestart,
  onCalibrate,
  modelPreview,
  recommendation,
}: GuidancePanelProps) {
  const activePoint = points.find((point) => point.id === activePointId) ?? points[0];
  const calibrationLabel =
    calibration.method === "hand_landmarker" && calibration.confidence > 0
      ? `1 寸 ≈ ${Math.round(calibration.pixelsPerCun)} px`
      : `預設 1 寸 ≈ ${Math.round(calibration.pixelsPerCun)} px`;

  return (
    <aside className="guidance-panel" aria-label="穴位指引">
      <div className="panel-head">
        <p className="eyebrow">Step 02</p>
        <h1>穴位指引</h1>
        <p className="subtle-text">
          {query.trim() ? query : "預設示意"} · {calibrationLabel}
        </p>
      </div>

      {modelPreview}

      {recommendation ? (
        <RecommendationPanel recommendation={recommendation} points={points} />
      ) : null}

      {activePoint ? (
        <section className="active-point" aria-live="polite">
          <div className="point-kicker">
            <LocateFixed size={16} strokeWidth={1.9} aria-hidden="true" />
            {activePoint.reason}
          </div>
          <h2>{activePoint.name}</h2>
          <p>{activePoint.location}</p>
          <div
            className={`ar-anchor-card ar-anchor-${activePoint.ar.confidence.toLowerCase()}`}
          >
            <span>AR {activePoint.ar.confidence}</span>
            <strong>{activePoint.ar.enabled ? "可鏡頭輔助" : "先保留於 3D 指引"}</strong>
            <small>{activePoint.ar.note}</small>
          </div>
          <dl>
            <div>
              <dt>功效</dt>
              <dd>{activePoint.effects.join("、")}</dd>
            </div>
            <div>
              <dt>按法</dt>
              <dd>{activePoint.action}</dd>
            </div>
            <div>
              <dt>時間</dt>
              <dd>{activePoint.duration}</dd>
            </div>
            <div>
              <dt>注意</dt>
              <dd>{activePoint.caution}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <div className="point-list" role="list" aria-label="匹配穴位">
        {points.map((point, index) => (
          <button
            type="button"
            key={point.id}
            className={`point-row ${point.id === activePointId ? "is-active" : ""}`}
            onClick={() => onSelectPoint(point.id)}
          >
            <span className="point-index">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <strong>{point.name}</strong>
              <small>{point.location}</small>
            </span>
          </button>
        ))}
      </div>

      <p className="safety-note">{safetyNote}</p>

      <div className="panel-actions">
        <button
          className="ghost-action"
          type="button"
          onClick={onRestart}
          data-testid="restart-guide"
        >
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
          重選
        </button>
        <button
          className="ghost-action"
          type="button"
          onClick={onCalibrate}
          data-testid="recalibrate-guide"
        >
          <RotateCcw size={17} strokeWidth={2} aria-hidden="true" />
          校正
        </button>
      </div>
    </aside>
  );
}
