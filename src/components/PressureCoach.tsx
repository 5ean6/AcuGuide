import {
  ArrowDown,
  ArrowUp,
  Hand,
  MoveHorizontal,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  getPressMotion,
  parsePressSeconds,
  pressMotionLabel,
  type PressMotion,
} from "../lib/pressGuidance";
import type { PointMatch } from "../types";

type PressureCoachProps = {
  point: PointMatch;
  detectedContact: boolean;
};

export function PressureCoach({ point, detectedContact }: PressureCoachProps) {
  const totalSeconds = useMemo(() => parsePressSeconds(point.duration), [point.duration]);
  const motion = useMemo(() => getPressMotion(point.action), [point.action]);
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [manualContact, setManualContact] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousPressingRef = useRef(false);
  const isPressing = detectedContact || manualContact;
  const isComplete = remainingSeconds === 0;
  const progress = (totalSeconds - remainingSeconds) / totalSeconds;

  useEffect(() => {
    setRemainingSeconds(totalSeconds);
    setManualContact(false);
    previousPressingRef.current = false;
  }, [point.id, totalSeconds]);

  useEffect(() => {
    if (!isPressing || isComplete) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isComplete, isPressing]);

  useEffect(() => {
    if (soundEnabled && isPressing && !previousPressingRef.current) {
      playTone(520, 0.08);
    }
    previousPressingRef.current = isPressing;
  }, [isPressing, soundEnabled]);

  useEffect(() => {
    if (!soundEnabled) {
      return;
    }
    if (remainingSeconds === 0) {
      playTone(760, 0.18);
    } else if (isPressing && remainingSeconds <= 3) {
      playTone(620, 0.06);
    }
  }, [isPressing, remainingSeconds, soundEnabled]);

  const progressStyle = {
    "--press-progress": `${Math.round(progress * 360)}deg`,
  } as CSSProperties;

  function beginManualContact() {
    if (!isComplete) {
      setManualContact(true);
    }
  }

  function endManualContact() {
    setManualContact(false);
  }

  return (
    <section
      className={`pressure-coach ${isPressing ? "is-pressing" : ""} ${
        isComplete ? "is-complete" : ""
      }`}
      data-testid="pressure-coach"
      aria-live="polite"
    >
      <div className="pressure-coach-head">
        <div>
          <span>按壓互動</span>
          <strong>{pressMotionLabel(motion)}</strong>
        </div>
        <button
          type="button"
          onClick={() => setSoundEnabled((enabled) => !enabled)}
          aria-label={soundEnabled ? "關閉提示音" : "開啟提示音"}
          title={soundEnabled ? "關閉提示音" : "開啟提示音"}
          data-testid="pressure-sound-toggle"
        >
          {soundEnabled ? (
            <Volume2 size={18} strokeWidth={2} aria-hidden="true" />
          ) : (
            <VolumeX size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="pressure-coach-body">
        <div className="pressure-timer" style={progressStyle}>
          <div className="pressure-pulse" aria-hidden="true" />
          <strong data-testid="pressure-countdown">
            {isComplete ? "完成" : remainingSeconds}
          </strong>
          {!isComplete ? <span>秒</span> : null}
        </div>
        <MotionGuide motion={motion} />
      </div>

      <p className="pressure-status" data-testid="pressure-contact-status">
        {isComplete
          ? "本次按壓完成，可以切換下一個穴位"
          : detectedContact
            ? "已偵測手部接觸，請維持適度力道"
            : manualContact
              ? "Demo 按壓中，放開即暫停"
              : "等待手部接觸目標點；也可按住下方按鈕模擬"}
      </p>

      <button
        className="pressure-hold-button"
        type="button"
        onPointerDown={beginManualContact}
        onPointerUp={endManualContact}
        onPointerCancel={endManualContact}
        onPointerLeave={endManualContact}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            beginManualContact();
          }
        }}
        onKeyUp={endManualContact}
        data-testid="pressure-hold"
      >
        <Hand size={18} strokeWidth={2} aria-hidden="true" />
        按住模擬按壓
      </button>
    </section>
  );
}

function MotionGuide({ motion }: { motion: PressMotion }) {
  const Icon =
    motion === "circle"
      ? RotateCw
      : motion === "down"
        ? ArrowDown
        : motion === "up"
          ? ArrowUp
          : motion === "outward"
            ? MoveHorizontal
            : Hand;

  return (
    <div className={`motion-guide motion-${motion}`} aria-hidden="true">
      <span className="motion-track" />
      <Icon size={24} strokeWidth={1.9} />
    </div>
  );
}

function playTone(frequency: number, duration: number) {
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Audio feedback is optional when browser autoplay policy blocks Web Audio.
  }
}
