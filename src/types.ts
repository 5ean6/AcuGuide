export type FeatureModeId = "face" | "body" | "wellness";

export type AppStage = "select" | "calibrate" | "guide";

export type CunCalibration = {
  pixelsPerCun: number;
  palmSpanPx: number;
  confidence: number;
  method: "hand_landmarker" | "manual";
  updatedAt?: number;
};

export type PointPosition = {
  x: number;
  y: number;
  z: number;
};

export type ArAnchorConfidence = "A" | "B" | "C" | "D";

export type ArAnchor = {
  enabled: boolean;
  confidence: ArAnchorConfidence;
  detector: "face" | "pose" | "hand" | "none";
  strategy: string;
  landmarkIndices?: number[];
  note: string;
};

export type FeatureMode = {
  id: FeatureModeId;
  title: string;
  compactTitle: string;
  meta: string;
  placeholder: string;
};

export type GuideGoal = {
  id: string;
  mode: FeatureModeId;
  label: string;
  description: string;
  query: string;
};

export type GuidePoint = {
  id: string;
  mode: FeatureModeId;
  name: string;
  location: string;
  action: string;
  duration: string;
  caution: string;
  effects: string[];
  tags: string[];
  position: PointPosition;
  priority: number;
  source: string;
  ar: ArAnchor;
};

export type AcupointKnowledgeEntry = Pick<
  GuidePoint,
  | "id"
  | "mode"
  | "name"
  | "location"
  | "action"
  | "duration"
  | "caution"
  | "effects"
  | "tags"
  | "source"
  | "ar"
>;

export type PointMatch = GuidePoint & {
  reason: string;
  score: number;
};

export type AcupointRecommendation = {
  mode: FeatureModeId;
  query: string;
  confidence: number;
  summary: string;
  engine: {
    llm: "Gemma 4 E2B";
    embedding: "EmbeddingGemma";
    status: "local_rag_preview" | "gemma_loading" | "gemma4_web" | "gemma_unavailable";
  };
};
