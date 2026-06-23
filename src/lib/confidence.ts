import type { ArAnchorConfidence } from "../types";

export function confidenceLabel(level: ArAnchorConfidence) {
  switch (level) {
    case "A":
      return "A 級：可即時追蹤";
    case "B":
      return "B 級：關鍵點推算";
    case "C":
      return "C 級：需校正輔助";
    case "D":
      return "D 級：僅 3D 參考";
  }
}
