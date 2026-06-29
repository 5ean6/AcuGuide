export type FeatureModeId = "face" | "body" | "wellness" | "other";
export type SidePreference = "both" | "left" | "right";
export type PointSide = "left" | "right" | "midline";

export type BodyRegionId =
  | "head-neck"
  | "chest"
  | "stomach"
  | "lower-back"
  | "upper-limb"
  | "lower-limb";

export type AppStage = "select" | "calibrate" | "guide" | "complete";

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

export type AcupointSurface = "front" | "back" | "side" | "top";

export type AcupointLaterality = "midline" | "bilateral";

export type AcupointGeometry = {
  position: PointPosition;
  surfaceDirection: PointPosition;
  surface: AcupointSurface;
  laterality: AcupointLaterality;
  region: string;
  referenceUrl?: string;
  projectionDistance?: number;
};

export type SymptomMarker = {
  label: string;
  position: PointPosition;
  surfaceDirection?: PointPosition;
  projectionDistance?: number;
  path?: PointPosition[];
};

export type BodyRegionPick = {
  id: BodyRegionId;
  label: string;
  query: string;
  position: PointPosition;
};

export type ArAnchor = {
  detector: "face" | "pose" | "hand";
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
  baseId?: string;
  side?: PointSide;
};

export type AcupointRecommendation = {
  mode: FeatureModeId;
  query: string;
  confidence: number;
  summary: string;
  engine: {
    llm: "Gemma 4 E2B";
    embedding: "EmbeddingGemma";
    status:
      | "local_rag_preview"
      | "gemma_loading"
      | "gemma4_web"
      | "gemma_unavailable"
      | "safety_blocked";
  };
};
