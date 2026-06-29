import {
  Check,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  LocateFixed,
  PersonStanding,
  ScanFace,
} from "lucide-react";
import { useRef } from "react";
import { guideGoals, featureModes } from "../data/acupoints";
import type { FeatureMode, FeatureModeId } from "../types";

type FeatureSelectorProps = {
  value: FeatureModeId;
  selectedGoalId?: string;
  previewGoalId?: string;
  onChange: (value: FeatureModeId) => void;
  onGoalSelect: (goalId: string) => void;
  onGoalPreview: (goalId: string) => void;
  onGoalPreviewEnd: () => void;
};

type CarouselItem = {
  mode: FeatureMode;
  offset: -1 | 0 | 1;
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
  const dragStartX = useRef<number | null>(null);
  const activeIndex = Math.max(
    0,
    featureModes.findIndex((mode) => mode.id === value),
  );
  const carouselItems: CarouselItem[] = [
    { mode: modeAt(activeIndex - 1), offset: -1 },
    { mode: modeAt(activeIndex), offset: 0 },
    { mode: modeAt(activeIndex + 1), offset: 1 },
  ];

  function selectAdjacent(direction: -1 | 1) {
    onGoalPreviewEnd();
    onChange(modeAt(activeIndex + direction).id);
  }

  function handlePointerUp(clientX: number) {
    if (dragStartX.current === null) {
      return;
    }

    const delta = clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < 42) {
      return;
    }

    selectAdjacent(delta < 0 ? 1 : -1);
  }

  return (
    <div
      className="feature-carousel"
      role="radiogroup"
      aria-label="選擇引導模式"
      onMouseLeave={onGoalPreviewEnd}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          onGoalPreviewEnd();
        }
      }}
      onPointerDown={(event) => {
        dragStartX.current = event.clientX;
      }}
      onPointerUp={(event) => handlePointerUp(event.clientX)}
      onPointerCancel={() => {
        dragStartX.current = null;
      }}
    >
      <button
        className="feature-nav feature-nav-prev"
        type="button"
        onClick={() => selectAdjacent(-1)}
        aria-label="切換到上一個引導模式"
        data-testid="feature-nav-prev"
      >
        <ChevronLeft size={22} strokeWidth={2.1} aria-hidden="true" />
      </button>

      <div className="feature-carousel-stage">
        {carouselItems.map(({ mode, offset }) => (
          <ModePanel
            key={`${mode.id}-${offset}`}
            mode={mode}
            offset={offset}
            selected={offset === 0}
            selectedGoalId={selectedGoalId}
            previewGoalId={previewGoalId}
            onModeSelect={() => {
              if (offset !== 0) {
                onGoalPreviewEnd();
                onChange(mode.id);
              }
            }}
            onGoalSelect={onGoalSelect}
            onGoalPreview={onGoalPreview}
            onGoalPreviewEnd={onGoalPreviewEnd}
          />
        ))}
      </div>

      <button
        className="feature-nav feature-nav-next"
        type="button"
        onClick={() => selectAdjacent(1)}
        aria-label="切換到下一個引導模式"
        data-testid="feature-nav-next"
      >
        <ChevronRight size={22} strokeWidth={2.1} aria-hidden="true" />
      </button>
    </div>
  );
}

function ModePanel({
  mode,
  offset,
  selected,
  selectedGoalId,
  previewGoalId,
  onModeSelect,
  onGoalSelect,
  onGoalPreview,
  onGoalPreviewEnd,
}: {
  mode: FeatureMode;
  offset: -1 | 0 | 1;
  selected: boolean;
  selectedGoalId?: string;
  previewGoalId?: string;
  onModeSelect: () => void;
  onGoalSelect: (goalId: string) => void;
  onGoalPreview: (goalId: string) => void;
  onGoalPreviewEnd: () => void;
}) {
  const Icon = iconForMode(mode.id);
  const goals = guideGoals.filter((goal) => goal.mode === mode.id);

  return (
    <section
      className={`feature-option feature-carousel-card ${
        selected ? "is-selected" : "is-side"
      } feature-carousel-card-${offset === -1 ? "prev" : offset === 1 ? "next" : "active"}`}
      data-testid={`feature-card-${mode.id}`}
      aria-hidden={!selected}
    >
      <button
        type="button"
        className="feature-main"
        aria-checked={selected}
        role="radio"
        tabIndex={selected ? 0 : -1}
        onClick={onModeSelect}
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

      <div className="goal-grid" aria-label={`${mode.title}症狀`}>
        {goals.map((goal) => {
          const goalSelected = selected && goal.id === selectedGoalId;
          const goalPreviewed = selected && goal.id === previewGoalId;
          return (
            <button
              key={goal.id}
              type="button"
              className={`goal-chip ${goalSelected ? "is-selected" : ""} ${
                goalPreviewed ? "is-previewed" : ""
              }`}
              aria-label={`選擇 ${goal.label}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                if (selected) {
                  onGoalSelect(goal.id);
                }
              }}
              onFocus={() => {
                if (selected) {
                  onGoalPreview(goal.id);
                }
              }}
              onMouseEnter={() => {
                if (selected) {
                  onGoalPreview(goal.id);
                }
              }}
              onMouseLeave={onGoalPreviewEnd}
              data-testid={`goal-${goal.id}`}
            >
              <span className="goal-label">{goal.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function modeAt(index: number) {
  return featureModes[(index + featureModes.length) % featureModes.length];
}

function iconForMode(mode: FeatureModeId) {
  if (mode === "face") {
    return ScanFace;
  }

  if (mode === "body") {
    return PersonStanding;
  }

  if (mode === "wellness") {
    return HeartPulse;
  }

  return LocateFixed;
}
