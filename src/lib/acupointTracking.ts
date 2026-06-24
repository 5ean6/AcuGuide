export type TrackingLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type FaceTargetLayout = {
  x: number;
  y: number;
};

export type BodyTrackingInput = {
  pose?: TrackingLandmark[];
  leftHand?: TrackingLandmark[];
  rightHand?: TrackingLandmark[];
};

export const faceAcupointLayouts: Record<string, FaceTargetLayout> = {
  yintang: { x: 0.5, y: 0.3 },
  jingming: { x: 0.47, y: 0.4 },
  zanzhu: { x: 0.43, y: 0.32 },
  sizhukong: { x: 0.68, y: 0.34 },
  tongziliao: { x: 0.7, y: 0.42 },
  sibai: { x: 0.58, y: 0.45 },
  taiyang: { x: 0.78, y: 0.37 },
  quanliao: { x: 0.66, y: 0.52 },
  yingxiang: { x: 0.58, y: 0.54 },
  xiaguan: { x: 0.73, y: 0.58 },
  jiache: { x: 0.7, y: 0.7 },
  touwei: { x: 0.72, y: 0.16 },
  baihui: { x: 0.5, y: 0.02 },
};

export const bodyTrackedPointIds = [
  "fengchi",
  "jianjing",
  "quchi",
  "hegu",
  "shenshu",
  "weizhong",
  "xuehai",
  "zusanli",
  "chengshan",
  "zhongwan",
  "tianshu",
  "qihai",
  "guanyuan",
  "neiguan",
  "sanyinjiao",
  "taichong",
] as const;

export function getBodyAcupointLandmark(
  pointId: string,
  input: BodyTrackingInput,
): TrackingLandmark | undefined {
  const pose = input.pose;
  const leftHand = input.leftHand;
  const rightHand = input.rightHand;
  const shoulders = average(pose?.[11], pose?.[12]);
  const hips = average(pose?.[23], pose?.[24]);

  switch (pointId) {
    case "fengchi":
      return interpolateVisible(pose?.[7], pose?.[11], 0.24) ??
        interpolateVisible(pose?.[8], pose?.[12], 0.24);
    case "jianjing":
      return interpolateVisible(shoulders, pose?.[11], 0.52) ??
        interpolateVisible(shoulders, pose?.[12], 0.52);
    case "quchi":
      return firstVisible(pose?.[13], pose?.[14]);
    case "hegu":
      return handPoint(leftHand, 2, 5, 0.55) ?? handPoint(rightHand, 2, 5, 0.55);
    case "shenshu":
      return offsetToward(interpolateVisible(shoulders, hips, 0.72), pose?.[23], 0.22);
    case "weizhong":
      return firstVisible(pose?.[25], pose?.[26]);
    case "xuehai":
      return inwardLegPoint(pose?.[25], pose?.[23], shoulders, 0.18);
    case "zusanli":
      return interpolateVisible(pose?.[25], pose?.[27], 0.28) ??
        interpolateVisible(pose?.[26], pose?.[28], 0.28);
    case "chengshan":
      return interpolateVisible(pose?.[25], pose?.[27], 0.56) ??
        interpolateVisible(pose?.[26], pose?.[28], 0.56);
    case "zhongwan":
      return interpolateVisible(shoulders, hips, 0.6);
    case "tianshu":
      return offsetToward(interpolateVisible(shoulders, hips, 0.76), pose?.[23], 0.28);
    case "qihai":
      return interpolateVisible(shoulders, hips, 0.84);
    case "guanyuan":
      return interpolateVisible(shoulders, hips, 0.93);
    case "neiguan":
      return interpolateVisible(pose?.[13], pose?.[15], 0.78) ??
        interpolateVisible(pose?.[14], pose?.[16], 0.78);
    case "sanyinjiao":
      return inwardLegPoint(pose?.[27], pose?.[25], shoulders, 0.18) ??
        inwardLegPoint(pose?.[28], pose?.[26], shoulders, 0.18);
    case "taichong":
      return interpolateVisible(pose?.[29], pose?.[31], 0.72) ??
        interpolateVisible(pose?.[30], pose?.[32], 0.72);
    default:
      return undefined;
  }
}

function handPoint(
  landmarks: TrackingLandmark[] | undefined,
  firstIndex: number,
  secondIndex: number,
  amount: number,
) {
  return interpolateVisible(landmarks?.[firstIndex], landmarks?.[secondIndex], amount);
}

function inwardLegPoint(
  distal: TrackingLandmark | undefined,
  proximal: TrackingLandmark | undefined,
  bodyCenter: TrackingLandmark | undefined,
  amount: number,
) {
  const point = interpolateVisible(distal, proximal, amount);
  return offsetToward(point, bodyCenter, 0.08);
}

function average(
  first: TrackingLandmark | undefined,
  second: TrackingLandmark | undefined,
) {
  if (!isVisible(first) || !isVisible(second)) return undefined;
  return interpolate(first, second, 0.5);
}

function firstVisible(...landmarks: Array<TrackingLandmark | undefined>) {
  return landmarks.find(isVisible);
}

function interpolateVisible(
  first: TrackingLandmark | undefined,
  second: TrackingLandmark | undefined,
  amount: number,
) {
  if (!isVisible(first) || !isVisible(second)) return undefined;
  return interpolate(first, second, amount);
}

function interpolate(first: TrackingLandmark, second: TrackingLandmark, amount: number) {
  return {
    x: first.x + (second.x - first.x) * amount,
    y: first.y + (second.y - first.y) * amount,
    z: (first.z ?? 0) + ((second.z ?? 0) - (first.z ?? 0)) * amount,
    visibility: Math.min(first.visibility ?? 1, second.visibility ?? 1),
  };
}

function offsetToward(
  point: TrackingLandmark | undefined,
  target: TrackingLandmark | undefined,
  amount: number,
) {
  if (!isVisible(point) || !isVisible(target)) return point;
  return interpolate(point, target, amount);
}

function isVisible(landmark: TrackingLandmark | undefined): landmark is TrackingLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= 0.52);
}
