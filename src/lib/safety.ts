import type {
  AcupointRecommendation,
  FeatureModeId,
  PointMatch,
} from "../types";

export type SafetySeverity = "clear" | "caution" | "block";

export type SafetyAssessment = {
  severity: SafetySeverity;
  title: string;
  message: string;
  matchedKeywords: string[];
  filteredPointIds: string[];
  removedPointNames: string[];
};

type SafetyRule = {
  title: string;
  message: string;
  keywords: string[];
};

type RecommendationResult = {
  recommendation: AcupointRecommendation;
  points: PointMatch[];
};

const highRiskRules: SafetyRule[] = [
  {
    title: "疑似急性心肺症狀",
    message: "胸痛、呼吸困難或冒冷汗等症狀不適合自行穴位按壓，請立即尋求醫療協助。",
    keywords: ["胸痛", "胸悶", "呼吸困難", "喘不過氣", "冒冷汗", "心悸"],
  },
  {
    title: "疑似神經系統急症",
    message: "突發無力、臉歪、口齒不清或意識異常需要優先就醫，不進入一般穴位推薦。",
    keywords: ["突發無力", "半身麻", "半身無力", "臉歪", "口齒不清", "昏迷", "意識不清"],
  },
  {
    title: "疑似腹部急症",
    message: "劇烈腹痛、持續嘔吐或高燒合併腹痛需要專業評估，請先停止自我按壓。",
    keywords: ["劇烈腹痛", "急性腹痛", "持續嘔吐", "血便", "黑便", "高燒腹痛"],
  },
  {
    title: "眼部異常警示",
    message: "視力突然改變、眼壓疼痛或眼部感染時，眼周穴位不應自行按壓。",
    keywords: ["視力突然", "視力模糊", "眼睛劇痛", "眼壓", "眼睛發炎", "眼部感染"],
  },
  {
    title: "皮膚屏障受損",
    message: "破皮、傷口、感染或紅腫熱痛處不適合按壓，請避開並視情況就醫。",
    keywords: ["破皮", "傷口", "感染", "流膿", "紅腫熱痛", "燙傷"],
  },
];

const pregnancyKeywords = ["懷孕", "孕婦", "妊娠", "備孕", "孕期"];

const clearAssessment: SafetyAssessment = {
  severity: "clear",
  title: "安全審核通過",
  message: "未偵測到需要攔截的高風險描述。",
  matchedKeywords: [],
  filteredPointIds: [],
  removedPointNames: [],
};

export function evaluateSafety(query: string, points: PointMatch[] = []): SafetyAssessment {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return clearAssessment;
  }

  for (const rule of highRiskRules) {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      normalizedQuery.includes(normalize(keyword)),
    );

    if (matchedKeywords.length > 0) {
      return {
        severity: "block",
        title: rule.title,
        message: rule.message,
        matchedKeywords,
        filteredPointIds: points.map((point) => point.id),
        removedPointNames: points.map((point) => point.name),
      };
    }
  }

  const pregnancyMatches = pregnancyKeywords.filter((keyword) =>
    normalizedQuery.includes(normalize(keyword)),
  );

  if (pregnancyMatches.length > 0) {
    const removedPoints = points.filter(hasPregnancyCaution);
    return {
      severity: "caution",
      title: "孕期禁忌已啟用",
      message: "系統偵測到孕期描述，會移除資料中標示孕期避免自行按壓的穴位。",
      matchedKeywords: pregnancyMatches,
      filteredPointIds: removedPoints.map((point) => point.id),
      removedPointNames: removedPoints.map((point) => point.name),
    };
  }

  return clearAssessment;
}

export function createSafetyBlockedRecommendation(input: {
  mode: FeatureModeId;
  query: string;
  assessment: SafetyAssessment;
}): AcupointRecommendation {
  return {
    mode: input.mode,
    query: input.query,
    confidence: 1,
    summary: `${input.assessment.title}：本次不提供一般穴位推薦`,
    engine: {
      llm: "Gemma 4 E2B",
      embedding: "EmbeddingGemma",
      status: "safety_blocked",
    },
  };
}

export function applySafetyToRecommendation(
  result: RecommendationResult,
  assessment: SafetyAssessment,
): RecommendationResult {
  if (assessment.severity === "block") {
    return {
      recommendation: createSafetyBlockedRecommendation({
        mode: result.recommendation.mode,
        query: result.recommendation.query,
        assessment,
      }),
      points: [],
    };
  }

  if (assessment.severity === "caution") {
    const safePoints = result.points.filter(
      (point) => !assessment.filteredPointIds.includes(point.id),
    );

    return {
      recommendation: {
        ...result.recommendation,
        confidence: Math.min(result.recommendation.confidence, 0.78),
        summary:
          assessment.filteredPointIds.length > 0
            ? `${result.recommendation.summary}（已移除孕期禁忌穴位）`
            : `${result.recommendation.summary}（已啟用孕期提醒）`,
      },
      points: safePoints,
    };
  }

  return result;
}

export function hasSafetyNotice(assessment: SafetyAssessment) {
  return assessment.severity !== "clear";
}

function hasPregnancyCaution(point: PointMatch) {
  return point.caution.includes("孕");
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
