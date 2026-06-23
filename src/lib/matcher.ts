import { guidePoints } from "../data/acupoints";
import type { FeatureModeId, PointMatch } from "../types";

const defaultPointIds: Record<FeatureModeId, string[]> = {
  face: ["jingming", "zanzhu", "sibai", "yingxiang"],
  body: ["jianjing", "fengchi", "hegu", "zusanli"],
  wellness: ["zhongwan", "tianshu", "guanyuan", "qihai"],
  other: ["fengchi", "hegu", "zusanli", "zhongwan"],
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function tokenize(value: string) {
  return value
    .split(/[\s,，、。；;/.|]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function scorePoint(pointText: string, tags: string[], query: string) {
  const normalizedQuery = normalize(query);
  const words = tokenize(query);

  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  tags.forEach((tag) => {
    const normalizedTag = normalize(tag);
    if (normalizedQuery.includes(normalizedTag)) {
      score += 6;
    }
    if (normalizedTag.includes(normalizedQuery)) {
      score += 4;
    }
    words.forEach((word) => {
      if (word.length > 1 && normalizedTag.includes(word)) {
        score += 3;
      }
    });
  });

  words.forEach((word) => {
    if (word.length > 1 && pointText.includes(normalize(word))) {
      score += 2;
    }
  });

  if (pointText.includes(normalizedQuery)) {
    score += 4;
  }

  if (normalizedQuery.includes("痛") || normalizedQuery.includes("痠")) {
    score += tags.some((tag) => tag.includes("疼痛") || tag.includes("痠痛")) ? 3 : 0;
  }

  return score;
}

function reasonFor(score: number, query: string) {
  if (!query.trim()) {
    return "預設導引";
  }

  if (score >= 8) {
    return "高度相關";
  }

  if (score >= 4) {
    return "症狀相近";
  }

  return "輔助搭配";
}

export function matchGuidePoints(mode: FeatureModeId, query: string): PointMatch[] {
  const candidates = guidePoints.filter((point) => mode === "other" || point.mode === mode);
  const scored = candidates
    .map((point) => {
      const pointText = normalize(
        [point.name, point.location, point.action, ...point.effects, ...point.tags].join(""),
      );
      const score = scorePoint(pointText, point.tags, query);

      return {
        ...point,
        score,
        reason: reasonFor(score, query),
      };
    })
    .sort((a, b) => b.score - a.score || b.priority - a.priority);

  if (query.trim() && scored.some((point) => point.score > 0)) {
    return scored.slice(0, 4);
  }

  const defaults = defaultPointIds[mode];
  return candidates
    .filter((point) => defaults.includes(point.id))
    .sort((a, b) => defaults.indexOf(a.id) - defaults.indexOf(b.id))
    .map((point) => ({
      ...point,
      score: point.priority,
      reason: "預設導引",
    }));
}
