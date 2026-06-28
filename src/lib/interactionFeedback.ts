type FeedbackKind = "tap" | "select" | "success" | "contact" | "warning";

type FeedbackOptions = {
  sound?: boolean;
  vibrate?: boolean;
};

type NativeFeedbackWindow = Window & {
  AcuGuideNativeFeedback?: {
    emit: (eventName: string) => void;
  };
};

let audioContext: AudioContext | null = null;

const vibrationPatterns: Record<FeedbackKind, number | number[]> = {
  tap: 12,
  select: 18,
  success: [28, 32, 42],
  contact: 24,
  warning: [22, 24, 22],
};

const tones: Record<FeedbackKind, { frequency: number; duration: number }> = {
  tap: { frequency: 420, duration: 0.045 },
  select: { frequency: 520, duration: 0.06 },
  success: { frequency: 760, duration: 0.14 },
  contact: { frequency: 610, duration: 0.08 },
  warning: { frequency: 260, duration: 0.1 },
};

export function playInteractionFeedback(
  kind: FeedbackKind,
  options: FeedbackOptions = {},
) {
  const { sound = true, vibrate = true } = options;
  emitNativeFeedback(kind);

  if (vibrate) {
    try {
      navigator.vibrate?.(vibrationPatterns[kind]);
    } catch {
      // Haptics are best-effort in browsers and unavailable on iOS Safari.
    }
  }

  if (!sound) {
    return;
  }

  const tone = tones[kind];
  playTone(tone.frequency, tone.duration);
}

function emitNativeFeedback(kind: FeedbackKind) {
  const eventName: Record<FeedbackKind, string> = {
    tap: "tap",
    select: "goal_select",
    success: "guide_complete",
    contact: "acupoint_contact_start",
    warning: "safety_warning",
  };

  try {
    (window as NativeFeedbackWindow).AcuGuideNativeFeedback?.emit(eventName[kind]);
  } catch {
    // Native feedback bridge is optional.
  }
}

export function playTone(frequency: number, duration: number) {
  try {
    const context = getAudioContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  } catch {
    // Audio feedback is optional when browser policy blocks Web Audio.
  }
}

function getAudioContext() {
  if (audioContext && audioContext.state !== "closed") {
    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }
    return audioContext;
  }

  const audioWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioContext = new AudioContextClass();
  return audioContext;
}
