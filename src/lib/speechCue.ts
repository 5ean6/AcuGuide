let lastSpokenText = "";
let lastSpokenAt = 0;

export function speakCue(text: string) {
  const trimmed = text.trim();
  if (!trimmed || !("speechSynthesis" in window)) {
    return;
  }

  const now = performance.now();
  if (trimmed === lastSpokenText && now - lastSpokenAt < 6000) {
    return;
  }

  lastSpokenText = trimmed;
  lastSpokenAt = now;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = "zh-TW";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 0.86;
  window.speechSynthesis.speak(utterance);
}
