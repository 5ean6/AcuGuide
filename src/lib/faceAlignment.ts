export type FaceAlignmentState = "searching" | "position" | "turn" | "level" | "aligned";

type FaceLandmarkLike = {
  x: number;
  y: number;
};

export type FaceAlignment = {
  state: FaceAlignmentState;
  instruction: string;
  yawOffset: number;
  rollDegrees: number;
};

export function getFaceAlignment(landmarks: FaceLandmarkLike[]): FaceAlignment {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  if (!leftEye || !rightEye || !nose) {
    return {
      state: "searching",
      instruction: "請讓完整臉部進入畫面",
      yawOffset: 0,
      rollDegrees: 0,
    };
  }

  const eyeSpan = Math.max(Math.abs(rightEye.x - leftEye.x), 0.001);
  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const yawOffset = (nose.x - eyeCenterX) / eyeSpan;
  const rollDegrees =
    (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI;

  if (Math.abs(yawOffset) > 0.12) {
    return {
      state: "turn",
      instruction: "請正對鏡頭，讓鼻尖回到雙眼中央",
      yawOffset,
      rollDegrees,
    };
  }

  if (Math.abs(rollDegrees) > 5) {
    return {
      state: "level",
      instruction: "請把頭擺正，讓雙眼保持水平",
      yawOffset,
      rollDegrees,
    };
  }

  return {
    state: "aligned",
    instruction: "臉部已擺正，請保持目前姿勢",
    yawOffset,
    rollDegrees,
  };
}
