import { CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AcupointRecommendation, FeatureMode, PointMatch } from "../types";

type CompletionPanelProps = {
  mode: FeatureMode;
  query: string;
  points: PointMatch[];
  recommendation: AcupointRecommendation | null;
  feedbackCount: number;
  onSaveFeedback: (rating: number, note: string) => boolean;
  onRestart: () => void;
};

export function CompletionPanel({
  mode,
  query,
  points,
  recommendation,
  feedbackCount,
  onSaveFeedback,
  onRestart,
}: CompletionPanelProps) {
  const [rating, setRating] = useState(4);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  function handleSave() {
    const ok = onSaveFeedback(rating, note);
    setSaved(ok);
    setSaveFailed(!ok);
  }

  return (
    <main className="complete-layout" aria-labelledby="complete-title">
      <section className="complete-summary">
        <p className="eyebrow">Step 05</p>
        <h1 id="complete-title">完成與回饋</h1>
        <p className="subtle-text">
          {mode.title} · {query.trim() ? query : "預設導引"}
        </p>

        <div className="complete-status">
          <CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" />
          <div>
            <strong>本次導引已完成</strong>
            <span>{recommendation?.summary ?? "已完成穴位導引流程"}</span>
          </div>
        </div>

        <div className="complete-point-list" role="list" aria-label="本次穴位">
          {points.map((point) => (
            <span key={point.id} role="listitem">
              {point.name} · MediaPipe 定位
            </span>
          ))}
        </div>

        <p className="privacy-note">
          <ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />
          回饋只寫入此瀏覽器 localStorage，不會上傳影像或症狀內容。
        </p>
      </section>

      <section className="feedback-panel" aria-label="回饋紀錄">
        <div>
          <p className="eyebrow">Feedback</p>
          <h2>舒緩感受</h2>
          <p className="subtle-text">目前本機保留 {feedbackCount} 筆紀錄。</p>
        </div>

        <div className="rating-grid" role="radiogroup" aria-label="舒緩評分">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              className={`rating-button ${rating === value ? "is-selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={rating === value}
              onClick={() => setRating(value)}
              data-testid={`feedback-rating-${value}`}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="feedback-note">
          <span>備註</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={160}
            placeholder="例如：肩膀比較放鬆、定位點需要微調"
          />
        </label>

        {saved ? (
          <p className="feedback-state" data-testid="feedback-saved">
            已儲存本機回饋。
          </p>
        ) : null}
        {saveFailed ? <p className="camera-error">localStorage 不可用，未能儲存。</p> : null}

        <div className="panel-actions">
          <button
            className="primary-action"
            type="button"
            onClick={handleSave}
            data-testid="save-feedback"
          >
            儲存回饋
          </button>
          <button
            className="ghost-action"
            type="button"
            onClick={onRestart}
            data-testid="restart-guide"
          >
            <RotateCcw size={17} strokeWidth={2} aria-hidden="true" />
            重新開始
          </button>
        </div>
      </section>
    </main>
  );
}
