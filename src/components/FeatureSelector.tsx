import { Check, HeartPulse, LocateFixed, PersonStanding, ScanFace } from "lucide-react";
import { guideGoals, featureModes } from "../data/acupoints";
import type { FeatureModeId } from "../types";

type FeatureSelectorProps = {
  value: FeatureModeId;
  selectedGoalId?: string;
  previewGoalId?: string;
  onChange: (value: FeatureModeId) => void;
  onGoalSelect: (goalId: string) => void;
  onGoalPreview: (goalId: string) => void;
  onGoalPreviewEnd: () => void;
};

export function FeatureSelector({
  value,
  selectedGoalId,
  previewGoalId,
  onChange,
  onGoalSelect,
  onGoalPreview,
  onGoalPreviewEnd,
}: FeatureSelectorProps) {
  return (
    <div
      className="feature-grid"
      role="radiogroup"
      aria-label="功能選擇"
      onMouseLeave={onGoalPreviewEnd}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          onGoalPreviewEnd();
        }
      }}
    >
      {featureModes.map((mode) => {
        const selected = value === mode.id;
        const Icon =
          mode.id === "face"
            ? ScanFace
            : mode.id === "body"
              ? PersonStanding
              : mode.id === "wellness"
                ? HeartPulse
                : LocateFixed;
        const goals = guideGoals.filter((goal) => goal.mode === mode.id);

        return (
          <section
            key={mode.id}
            className={`feature-option ${selected ? "is-selected" : ""}`}
            data-testid={`feature-card-${mode.id}`}
          >
            <button
              type="button"
              className="feature-main"
              aria-checked={selected}
              role="radio"
              onClick={() => onChange(mode.id)}
              data-testid={`feature-${mode.id}`}
            >
              <span className="feature-icon" aria-hidden="true">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span>
                <span className="feature-title">{mode.title}</span>
                <span className="feature-meta">{mode.meta}</span>
              </span>
              {selected ? (
                <span className="feature-check" aria-hidden="true">
                  <Check size={16} strokeWidth={2} />
                </span>
              ) : null}
            </button>

            <div className="goal-grid" aria-label={`${mode.title}目標`}>
              {goals.map((goal) => {
                const goalSelected = goal.id === selectedGoalId;
                const goalPreviewed = selected && goal.id === previewGoalId;
                const handleGoalPreview = () => {
                  if (selected) {
                    onGoalPreview(goal.id);
                    return;
                  }

                  onGoalPreviewEnd();
                };
                return (
                  <button
                    key={goal.id}
                    type="button"
                    className={`goal-chip ${goalSelected ? "is-selected" : ""} ${
                      goalPreviewed ? "is-previewed" : ""
                    }`}
                    aria-label={`選擇 ${goal.label}`}
                    onClick={() => onGoalSelect(goal.id)}
                    onFocus={handleGoalPreview}
                    onMouseEnter={handleGoalPreview}
                    data-testid={`goal-${goal.id}`}
                  >
                    <span className="goal-label">{goal.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
