import type { AppStage } from "../types";

export type DemoFlowEvent =
  | "confirmRecommendation"
  | "requestCalibration"
  | "finishCalibration"
  | "completeGuide"
  | "restart";

export function nextDemoStage(current: AppStage, event: DemoFlowEvent): AppStage {
  if (event === "restart") {
    return "select";
  }

  if (current === "select" && event === "confirmRecommendation") {
    return "guide";
  }

  if (current === "guide" && event === "requestCalibration") {
    return "calibrate";
  }

  if (current === "calibrate" && event === "finishCalibration") {
    return "guide";
  }

  if (current === "guide" && event === "completeGuide") {
    return "complete";
  }

  return current;
}
