import type { SymptomMarker } from "../types";

export const symptomLocations: Record<string, SymptomMarker> = {
  "face-eyelid-puffiness": marker("眼周疲勞位置", [0.34, 0.32, 0.72], [0.25, 0, 1]),
  "face-apple-cheek": marker("蘋果肌位置", [0.38, 0.14, 0.62], [0.42, 0, 0.9]),
  "face-slim": marker("下顎緊繃位置", [0.4, -0.11, 0.5], [0.65, 0, 0.76]),
  "face-nasolabial": {
    ...marker("法令紋位置", [0.28, 0.04, 0.62], [0.25, 0, 1]),
    path: [
      { x: 0.21, y: 0.15, z: 0.64 },
      { x: 0.27, y: 0.06, z: 0.64 },
      { x: 0.32, y: -0.04, z: 0.58 },
    ],
  },
  "body-shoulder-neck": marker("肩頸痠痛位置", [0.37, 0.84, 0.06], [0.18, 1, 0.12]),
  "body-lower-back": marker("腰背緊繃位置", [0.12, 0.14, 0.25], [0, 0, 1]),
  "body-knee-leg": marker("膝腿不適位置", [0.19, -0.72, -0.14], [0, 0, -1]),
  "wellness-bloating": marker("腹脹位置", [0, -0.02, -0.22], [0, 0, -1]),
  "wellness-digestion": marker("消化不適位置", [0, 0.16, -0.22], [0, 0, -1]),
  "wellness-fatigue": marker("疲勞感受位置", [0, 1.35, -0.2], [0, 0, -1]),
};

export function getSymptomMarker(goalId?: string): SymptomMarker | undefined {
  return goalId ? symptomLocations[goalId] : undefined;
}

function marker(
  label: string,
  [x, y, z]: [number, number, number],
  [directionX, directionY, directionZ]: [number, number, number],
): SymptomMarker {
  return {
    label,
    position: { x, y, z },
    surfaceDirection: { x: directionX, y: directionY, z: directionZ },
  };
}
