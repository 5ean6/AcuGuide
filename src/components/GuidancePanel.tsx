import { ArrowLeft, ExternalLink, LocateFixed, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { safetyNote } from "../data/acupoints";
import { getAcupointGeometry } from "../data/acupointGeometry";
import type { AcupointRecommendation, CunCalibration, PointMatch } from "../types";

type GuidancePanelProps = {
  points: PointMatch[];
  activePointId: string;
  calibration: CunCalibration;
  query: string;
  onSelectPoint: (id: string) => void;
  onRestart: () => void;
  onCalibrate: () => void;
  onComplete: () => void;
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
  onComplete,
}: GuidancePanelProps) {
  const activePoint = points.find((point) => point.id === activePointId) ?? points[0];
  const activeGeometry = activePoint ? getAcupointGeometry(activePoint.id) : undefined;
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

      {activePoint ? (
        <>
          <section className="active-point" aria-live="polite">
          <div className="point-kicker">
            <LocateFixed size={16} strokeWidth={1.9} aria-hidden="true" />
            {activePoint.reason}
          </div>
          <h2>{activePoint.name}</h2>
          <p>{activePoint.location}</p>
          {activeGeometry ? (
            <div className="point-anatomy-meta">
              <span>
                {activeGeometry.region} · {surfaceLabel(activeGeometry.surface)}
              </span>
              {activeGeometry.referenceUrl ? (
                <a href={activeGeometry.referenceUrl} target="_blank" rel="noreferrer">
                  穴位參考
                  <ExternalLink size={13} strokeWidth={2} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="ar-anchor-card">
            <LocateFixed size={17} strokeWidth={2} aria-hidden="true" />
            <strong>MediaPipe 即時穴位定位</strong>
            <small>{activePoint.ar.strategy}</small>
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
        </>
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
        <button
          className="primary-action"
          type="button"
          onClick={onComplete}
          data-testid="complete-guide"
        >
          完成
        </button>
      </div>
    </aside>
  );
}

function surfaceLabel(surface: "front" | "back" | "side" | "top") {
  return {
    front: "身體前側",
    back: "身體後側",
    side: "身體側面",
    top: "上方表面",
  }[surface];
}
