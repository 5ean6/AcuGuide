import type { ArAnchorConfidence, FeatureModeId, PointMatch } from "../types";

export const FEEDBACK_STORAGE_KEY = "acuguide.feedback.v1";

export type FeedbackRecord = {
  id: string;
  createdAt: string;
  mode: FeatureModeId;
  query: string;
  pointIds: string[];
  confidenceGrades: ArAnchorConfidence[];
  rating: number;
  note: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createFeedbackRecord(input: {
  mode: FeatureModeId;
  query: string;
  points: PointMatch[];
  rating: number;
  note?: string;
  now?: Date;
}): FeedbackRecord {
  const now = input.now ?? new Date();

  return {
    id: `${now.getTime()}-${input.mode}`,
    createdAt: now.toISOString(),
    mode: input.mode,
    query: input.query,
    pointIds: input.points.map((point) => point.id),
    confidenceGrades: input.points.map((point) => point.ar.confidence),
    rating: clampRating(input.rating),
    note: input.note?.trim() ?? "",
  };
}

export function loadFeedbackRecords(storage = getLocalStorage()): FeedbackRecord[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFeedbackRecord) : [];
  } catch {
    return [];
  }
}

export function saveFeedbackRecord(record: FeedbackRecord, storage = getLocalStorage()) {
  if (!storage) {
    return false;
  }

  try {
    const records = loadFeedbackRecords(storage);
    const nextRecords = [record, ...records].slice(0, 20);
    storage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(nextRecords));
    return true;
  } catch {
    return false;
  }
}

function getLocalStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function isFeedbackRecord(value: unknown): value is FeedbackRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<FeedbackRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.mode === "string" &&
    typeof record.query === "string" &&
    Array.isArray(record.pointIds) &&
    Array.isArray(record.confidenceGrades) &&
    typeof record.rating === "number" &&
    typeof record.note === "string"
  );
}

function clampRating(value: number) {
  return Math.min(5, Math.max(1, Math.round(value)));
}
