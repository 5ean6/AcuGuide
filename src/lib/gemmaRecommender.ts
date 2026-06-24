import { FilesetResolver, LlmInference } from "@mediapipe/tasks-genai";
import { acupointKnowledgeBase, guidePoints } from "../data/acupoints";
import type { FeatureModeId, PointMatch } from "../types";
import { matchGuidePoints } from "./matcher";
import { recommendAcupoints } from "./recommender";
import { assetPath } from "./assetPaths";

type GemmaRecommendationInput = {
  mode: FeatureModeId;
  query: string;
  fallbackGoalId?: string;
};

type GemmaRecommendationOutput = ReturnType<typeof recommendAcupoints>;

const WASM_ROOT = assetPath("genai/wasm");
const GEMMA_MODEL_PATH = assetPath("models/gemma/gemma-4-E2B-it-web.task");
let llmPromise: Promise<LlmInference> | null = null;

export async function recommendAcupointsWithGemma(
  input: GemmaRecommendationInput,
): Promise<GemmaRecommendationOutput> {
  const fallback = recommendAcupoints(input);
  const llm = await getGemmaInference();
  const candidates = guidePoints.filter((point) => point.mode === input.mode);
  const response = await llm.generateResponse(buildPrompt(input));
  const selectedIds = parsePointIds(response);
  const selectedPoints = selectedIds
    .map((id) => candidates.find((point) => point.id === id))
    .filter(Boolean)
    .slice(0, 4) as PointMatch[];

  const points =
    selectedPoints.length > 0
      ? selectedPoints.map((point, index) => ({
          ...point,
          score: Math.max(1, 12 - index * 2),
          reason: "Gemma 4 E2B 推薦",
        }))
      : fallback.points;

  return {
    recommendation: {
      ...fallback.recommendation,
      confidence: selectedPoints.length > 0 ? 0.86 : fallback.recommendation.confidence,
      summary: buildGemmaSummary(points),
      engine: {
        llm: "Gemma 4 E2B",
        embedding: "EmbeddingGemma",
        status: "gemma4_web",
      },
    },
    points,
  };
}

async function getGemmaInference() {
  if (llmPromise) {
    return llmPromise;
  }

  llmPromise = createGemmaInference();
  return llmPromise;
}

async function createGemmaInference() {
  if (import.meta.env.PROD) {
    throw new Error("Gemma 未包含在 production 靜態部署版本");
  }

  if (!("gpu" in navigator) || navigator.webdriver) {
    throw new Error("Gemma 4 Web 需要瀏覽器支援 WebGPU");
  }

  const genai = await FilesetResolver.forGenAiTasks(WASM_ROOT);
  const device = await LlmInference.createWebGpuDevice();

  return LlmInference.createFromOptions(genai, {
    baseOptions: {
      modelAssetPath: GEMMA_MODEL_PATH,
      delegate: "GPU",
      gpuOptions: { device },
    },
    maxTokens: 2048,
    temperature: 0,
    topK: 1,
    randomSeed: 7,
  });
}

function buildPrompt(input: GemmaRecommendationInput) {
  const localCandidates = matchGuidePoints(input.mode, input.query)
    .slice(0, 4)
    .map((point) => point.id);
  const knowledgeCandidates = acupointKnowledgeBase.filter((point) => point.mode === input.mode);
  const candidateText = knowledgeCandidates
    .map((point) =>
      [
        `id=${point.id}`,
        `name=${point.name}`,
        `location=${point.location}`,
        `effects=${point.effects.join(", ")}`,
        `tags=${point.tags.join(", ")}`,
        `action=${point.action}`,
        `caution=${point.caution}`,
        `tracking=${point.ar.detector} ${point.ar.strategy}`,
      ].join(" | "),
    )
    .join("\n");

  return `你是穴位推薦器，只能從候選穴位 id 裡選。不要提供診斷，不要新增資料庫沒有的穴位。

使用者需求：${input.query || "未輸入，依模式預設推薦"}
目前模式：${input.mode}
本機檢索候選：${localCandidates.join(", ") || "none"}

候選穴位：
${candidateText}

請只輸出 JSON，不要 Markdown，不要解釋。格式：
{"pointIds":["id1","id2","id3"],"confidence":0.0,"reason":"一句繁體中文理由"}`;
}

function parsePointIds(response: string) {
  const jsonText = response.match(/\{[\s\S]*\}/)?.[0] ?? response;
  try {
    const parsed = JSON.parse(jsonText) as { pointIds?: unknown };
    if (!Array.isArray(parsed.pointIds)) {
      return [];
    }
    return parsed.pointIds.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function buildGemmaSummary(points: PointMatch[]) {
  if (!points.length) {
    return "Gemma 暫無推薦穴位";
  }

  return `Gemma 推薦先按 ${points
    .slice(0, 3)
    .map((point) => point.name)
    .join("、")}`;
}
