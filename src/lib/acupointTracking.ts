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
  jingming: { x: 0.455, y: 0.405 },
  zanzhu: { x: 0.395, y: 0.315 },
  sizhukong: { x: 0.725, y: 0.31 },
  tongziliao: { x: 0.765, y: 0.405 },
  sibai: { x: 0.615, y: 0.47 },
  taiyang: { x: 0.82, y: 0.36 },
  quanliao: { x: 0.7, y: 0.54 },
  yingxiang: { x: 0.615, y: 0.55 },
  xiaguan: { x: 0.77, y: 0.57 },
  jiache: { x: 0.74, y: 0.7 },
  touwei: { x: 0.76, y: 0.14 },
  baihui: { x: 0.5, y: 0.02 },
};

export function getFaceAcupointLayout(pointId: string): FaceTargetLayout | undefined {
  const [baseId, side] = pointId.split(":");
  const layout = faceAcupointLayouts[baseId ?? pointId];
  if (!layout || (side !== "left" && side !== "right")) {
    return layout;
  }

  const leftX = layout.x <= 0.5 ? layout.x : 1 - layout.x;
  const rightX = 1 - leftX;
  return {
    ...layout,
    x: side === "left" ? leftX : rightX,
  };
}

export function getFaceAcupointLandmark(
  pointId: string,
  landmarks: TrackingLandmark[],
): TrackingLandmark | undefined {
  const [baseId, sideValue] = pointId.split(":");
  const side = sideValue === "left" || sideValue === "right" ? sideValue : undefined;
  const pair = faceAnchorPairs[baseId ?? pointId];
  if (!pair) {
    return undefined;
  }

  const anchor = side === "left" ? pair.left : pair.right;
  return anchor?.(landmarks);
}

type FaceAnchorPair = {
  left: (landmarks: TrackingLandmark[]) => TrackingLandmark | undefined;
  right: (landmarks: TrackingLandmark[]) => TrackingLandmark | undefined;
};

const faceAnchorPairs: Record<string, FaceAnchorPair> = {
  yintang: centerAnchor((landmarks) => average(landmarks[9], landmarks[168], landmarks[151])),
  jingming: sideAnchors(
    (landmarks) => offsetBetween(landmarks[133], landmarks[168], 0.08),
    (landmarks) => offsetBetween(landmarks[362], landmarks[168], 0.08),
  ),
  zanzhu: sideAnchors(
    (landmarks) => offsetBetween(average(landmarks[55], landmarks[65]), landmarks[168], 0.05),
    (landmarks) => offsetBetween(average(landmarks[285], landmarks[295]), landmarks[168], 0.05),
  ),
  sizhukong: sideAnchors(
    (landmarks) => offsetBetween(landmarks[70], landmarks[33], 0.12),
    (landmarks) => offsetBetween(landmarks[300], landmarks[263], 0.12),
  ),
  tongziliao: sideAnchors(
    (landmarks) => offsetBetween(landmarks[33], landmarks[234], 0.28),
    (landmarks) => offsetBetween(landmarks[263], landmarks[454], 0.28),
  ),
  sibai: sideAnchors(
    (landmarks) => offsetFromEyeCenter(landmarks, "left", 0.52),
    (landmarks) => offsetFromEyeCenter(landmarks, "right", 0.52),
  ),
  taiyang: sideAnchors(
    (landmarks) => offsetBetween(average(landmarks[33], landmarks[70]), landmarks[234], 0.52),
    (landmarks) => offsetBetween(average(landmarks[263], landmarks[300]), landmarks[454], 0.52),
  ),
  quanliao: sideAnchors(
    (landmarks) => offsetBetween(landmarks[50], landmarks[205], 0.54),
    (landmarks) => offsetBetween(landmarks[280], landmarks[425], 0.54),
  ),
  yingxiang: sideAnchors(
    (landmarks) => offsetBetween(landmarks[98], landmarks[129], 0.36),
    (landmarks) => offsetBetween(landmarks[327], landmarks[358], 0.36),
  ),
  xiaguan: sideAnchors(
    (landmarks) => offsetBetween(landmarks[234], landmarks[172], 0.55),
    (landmarks) => offsetBetween(landmarks[454], landmarks[397], 0.55),
  ),
  jiache: sideAnchors(
    (landmarks) => offsetBetween(landmarks[172], landmarks[58], 0.52),
    (landmarks) => offsetBetween(landmarks[397], landmarks[288], 0.52),
  ),
  touwei: sideAnchors(
    (landmarks) => offsetBetween(landmarks[70], landmarks[10], 0.52),
    (landmarks) => offsetBetween(landmarks[300], landmarks[10], 0.52),
  ),
  baihui: centerAnchor((landmarks) => landmarks[10]),
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
  const [basePointId, sideValue] = pointId.split(":");
  const side = sideValue === "left" || sideValue === "right" ? sideValue : undefined;
  const pose = input.pose;
  const leftHand = input.leftHand;
  const rightHand = input.rightHand;
  const shoulders = average(pose?.[11], pose?.[12]);
  const hips = average(pose?.[23], pose?.[24]);
  const sideShoulder = chooseSide(side, pose?.[11], pose?.[12]);
  const sideHip = chooseSide(side, pose?.[23], pose?.[24]);
  const sideElbow = chooseSide(side, pose?.[13], pose?.[14]);
  const sideWrist = chooseSide(side, pose?.[15], pose?.[16]);
  const sideKnee = chooseSide(side, pose?.[25], pose?.[26]);
  const sideAnkle = chooseSide(side, pose?.[27], pose?.[28]);
  const sideHeel = chooseSide(side, pose?.[29], pose?.[30]);
  const sideFoot = chooseSide(side, pose?.[31], pose?.[32]);
  const sideHand = side === "right" ? rightHand : side === "left" ? leftHand : leftHand;

  switch (basePointId) {
    case "fengchi":
      return side === "right"
        ? interpolateVisible(pose?.[8], pose?.[12], 0.24)
        : side === "left"
          ? interpolateVisible(pose?.[7], pose?.[11], 0.24)
          : interpolateVisible(pose?.[7], pose?.[11], 0.24) ??
            interpolateVisible(pose?.[8], pose?.[12], 0.24);
    case "jianjing":
      return interpolateVisible(shoulders, sideShoulder, 0.52) ??
        interpolateVisible(shoulders, pose?.[11], 0.52) ??
        interpolateVisible(shoulders, pose?.[12], 0.52);
    case "quchi":
      return firstVisible(sideElbow, pose?.[13], pose?.[14]);
    case "hegu":
      return handPoint(sideHand, 2, 5, 0.55) ??
        handPoint(leftHand, 2, 5, 0.55) ??
        handPoint(rightHand, 2, 5, 0.55);
    case "shenshu":
      return offsetToward(interpolateVisible(shoulders, hips, 0.72), sideHip, 0.22);
    case "weizhong":
      return firstVisible(sideKnee, pose?.[25], pose?.[26]);
    case "xuehai":
      return inwardLegPoint(sideKnee, sideHip, shoulders, 0.18);
    case "zusanli":
      return interpolateVisible(sideKnee, sideAnkle, 0.28) ??
        interpolateVisible(pose?.[25], pose?.[27], 0.28) ??
        interpolateVisible(pose?.[26], pose?.[28], 0.28);
    case "chengshan":
      return interpolateVisible(sideKnee, sideAnkle, 0.56) ??
        interpolateVisible(pose?.[25], pose?.[27], 0.56) ??
        interpolateVisible(pose?.[26], pose?.[28], 0.56);
    case "zhongwan":
      return interpolateVisible(shoulders, hips, 0.6);
    case "tianshu":
      return offsetToward(interpolateVisible(shoulders, hips, 0.76), sideHip, 0.28);
    case "qihai":
      return interpolateVisible(shoulders, hips, 0.84);
    case "guanyuan":
      return interpolateVisible(shoulders, hips, 0.93);
    case "neiguan":
      return interpolateVisible(sideElbow, sideWrist, 0.78) ??
        interpolateVisible(pose?.[13], pose?.[15], 0.78) ??
        interpolateVisible(pose?.[14], pose?.[16], 0.78);
    case "sanyinjiao":
      return inwardLegPoint(sideAnkle, sideKnee, shoulders, 0.18) ??
        inwardLegPoint(pose?.[27], pose?.[25], shoulders, 0.18) ??
        inwardLegPoint(pose?.[28], pose?.[26], shoulders, 0.18);
    case "taichong":
      return interpolateVisible(sideHeel, sideFoot, 0.72) ??
        interpolateVisible(pose?.[29], pose?.[31], 0.72) ??
        interpolateVisible(pose?.[30], pose?.[32], 0.72);
    default:
      return undefined;
  }
}

function chooseSide(
  side: "left" | "right" | undefined,
  left: TrackingLandmark | undefined,
  right: TrackingLandmark | undefined,
) {
  if (side === "right") return right;
  if (side === "left") return left;
  return firstVisible(left, right);
}

function sideAnchors(
  left: FaceAnchorPair["left"],
  right: FaceAnchorPair["right"],
): FaceAnchorPair {
  return { left, right };
}

function centerAnchor(anchor: FaceAnchorPair["left"]): FaceAnchorPair {
  return { left: anchor, right: anchor };
}

function offsetFromEyeCenter(
  landmarks: TrackingLandmark[],
  side: "left" | "right",
  verticalAmount: number,
) {
  const upper = side === "left"
    ? average(landmarks[159], landmarks[160])
    : average(landmarks[386], landmarks[387]);
  const lower = side === "left"
    ? average(landmarks[145], landmarks[144])
    : average(landmarks[374], landmarks[373]);
  const eyeCenter = average(upper, lower);
  if (!eyeCenter || !lower) {
    return undefined;
  }

  const verticalGap = Math.max(Math.abs((lower.y ?? 0) - (upper?.y ?? lower.y)), 0.012);
  return {
    ...eyeCenter,
    y: lower.y + verticalGap * verticalAmount,
  };
}

function offsetBetween(
  point: TrackingLandmark | undefined,
  target: TrackingLandmark | undefined,
  amount: number,
) {
  return offsetToward(point, target, amount);
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

function average(...landmarks: Array<TrackingLandmark | undefined>) {
  const visible = landmarks.filter(isVisible);
  if (!visible.length || visible.length !== landmarks.length) return undefined;
  return {
    x: visible.reduce((sum, landmark) => sum + landmark.x, 0) / visible.length,
    y: visible.reduce((sum, landmark) => sum + landmark.y, 0) / visible.length,
    z: visible.reduce((sum, landmark) => sum + (landmark.z ?? 0), 0) / visible.length,
    visibility: Math.min(...visible.map((landmark) => landmark.visibility ?? 1)),
  };
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
