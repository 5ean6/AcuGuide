import { ShieldAlert } from "lucide-react";
import type { SafetyAssessment } from "../lib/safety";

type SafetyAlertPanelProps = {
  assessment: SafetyAssessment;
};

export function SafetyAlertPanel({ assessment }: SafetyAlertPanelProps) {
  if (assessment.severity === "clear") {
    return null;
  }

  const isBlocked = assessment.severity === "block";

  return (
    <section
      className={`safety-alert safety-alert-${assessment.severity}`}
      aria-live="polite"
      data-testid={isBlocked ? "safety-block" : "safety-alert"}
    >
      <div className="safety-alert-head">
        <ShieldAlert size={17} strokeWidth={2} aria-hidden="true" />
        <span>{isBlocked ? "安全攔截" : "安全提醒"}</span>
      </div>
      <strong>{assessment.title}</strong>
      <p>{assessment.message}</p>
      {assessment.matchedKeywords.length > 0 ? (
        <small>觸發詞：{assessment.matchedKeywords.join("、")}</small>
      ) : null}
      {assessment.removedPointNames.length > 0 ? (
        <small>已排除：{assessment.removedPointNames.join("、")}</small>
      ) : null}
      {isBlocked ? <small>本次不顯示一般穴位推薦。</small> : null}
    </section>
  );
}
