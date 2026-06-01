import {
  Camera,
  Loader2,
  LocateFixed,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

type TrackingStatus = "idle" | "loading" | "running" | "error";

type PoseSummary = {
  poseCount: number;
  faceCount: number;
  leftHandCount: number;
  rightHandCount: number;
  totalCount: number;
  instruction: string;
  shoulderTilt: number;
  bodyCoverage: number;
};

type BodyTrackingPanelProps = {
  targetPointId?: string;
  targetLabel?: string;
};

type CombinedLandmarkers = {
  pose: PoseLandmarker;
  face: FaceLandmarker;
  hands: HandLandmarker;
};

type CombinedLandmarkResult = {
  poseLandmarks: NormalizedLandmark[][];
  faceLandmarks: NormalizedLandmark[][];
  leftHandLandmarks: NormalizedLandmark[][];
  rightHandLandmarks: NormalizedLandmark[][];
};

type CoverRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

const WASM_ROOT = "/mediapipe/wasm";
const POSE_MODEL_PATH = "/models/mediapipe/pose_landmarker_lite.task";
const FACE_MODEL_PATH = "/models/mediapipe/face_landmarker.task";
const HAND_MODEL_PATH = "/models/mediapipe/hand_landmarker.task";
const CORE_LANDMARKS = [11, 12, 23, 24, 25, 26];
const HOLISTIC_TOTAL_LANDMARKS = 543;
const FACE_LANDMARK_COUNT = 468;
const FACE_CONNECTION_GROUPS = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_LIPS,
];

export function BodyTrackingPanel({ targetPointId, targetLabel }: BodyTrackingPanelProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<CombinedLandmarkers | null>(null);
  const frameRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastSummaryAtRef = useRef(0);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [summary, setSummary] = useState<PoseSummary>(() => createIdleSummary(targetLabel));
  const [error, setError] = useState("");

  const isRunning = status === "running";
  const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!isRunning) {
      setSummary(createIdleSummary(targetLabel));
    }
  }, [isRunning, targetLabel]);

  useEffect(() => {
    return () => {
      stopCamera();
      closeLandmarkers(landmarkerRef.current);
      landmarkerRef.current = null;
    };
  }, []);

  async function ensureLandmarker() {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const [pose, face, hands] = await Promise.all([
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_PATH,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }),
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_PATH,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      }),
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_PATH,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }),
    ]);
    const landmarkers = { pose, face, hands };
    landmarkerRef.current = landmarkers;
    return landmarkers;
  }

  async function startCamera() {
    if (!canUseCamera) {
      setStatus("error");
      setError("這個瀏覽器不支援相機權限。");
      return;
    }

    try {
      setStatus("loading");
      setError("");
      const landmarker = await ensureLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        throw new Error("找不到相機預覽元件。");
      }

      video.srcObject = stream;
      await video.play();
      setStatus("running");
      lastVideoTimeRef.current = -1;
      runPoseLoop(landmarker);
    } catch (errorValue) {
      stopCamera();
      setStatus("error");
      setError(formatCameraError(errorValue));
    }
  }

  function stopCamera() {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    clearCanvas();
    setSummary(createIdleSummary(targetLabel));
    setStatus("idle");
  }

  function runPoseLoop(landmarkers: CombinedLandmarkers) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const preview = previewRef.current;
    if (!video || !canvas || !preview) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      syncCanvasSize(canvas, preview);

      if (video.currentTime !== lastVideoTimeRef.current) {
        const result = detectCombinedLandmarks(landmarkers, video, performance.now());
        drawCameraFrame(ctx, canvas, video);
        drawHolistic(ctx, canvas, video, result, targetPointId, targetLabel);
        lastVideoTimeRef.current = video.currentTime;
        updateSummary(result);
      }
    }

    frameRef.current = requestAnimationFrame(() => runPoseLoop(landmarkers));
  }

  function updateSummary(result: CombinedLandmarkResult) {
    const now = performance.now();
    if (now - lastSummaryAtRef.current < 240) {
      return;
    }
    lastSummaryAtRef.current = now;
    setSummary(analyzeHolistic(result, targetLabel));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <section
      className="camera-panel"
      aria-label="鏡頭確認部位"
      data-testid="body-tracking-panel"
    >
      <div className="camera-panel-head">
        <div>
          <p className="eyebrow">MediaPipe</p>
          <h2>{targetLabel ? "鏡頭確認部位" : "鏡頭初步定位"}</h2>
        </div>
        <div
          className={`camera-state camera-state-${status}`}
          data-testid="camera-state"
        >
          {status === "loading" ? (
            <Loader2 size={14} strokeWidth={2} aria-hidden="true" />
          ) : (
            <LocateFixed size={14} strokeWidth={2} aria-hidden="true" />
          )}
          {statusLabel(status)}
        </div>
      </div>

      {targetLabel ? (
        <p className="camera-target">
          目前要確認：<strong>{targetLabel}</strong>
        </p>
      ) : null}

      <div className="camera-preview" ref={previewRef}>
        <video
          className="camera-source"
          ref={videoRef}
          muted
          playsInline
          aria-label="相機來源"
        />
        <canvas ref={canvasRef} aria-hidden="true" />
        {!isRunning ? (
          <div className="camera-placeholder">
            <Camera size={30} strokeWidth={1.6} aria-hidden="true" />
            <span>相機尚未開啟</span>
          </div>
        ) : null}
      </div>

      <div className="pose-readout">
        <strong>{summary.instruction}</strong>
        <span>
          Holistic {summary.totalCount}/{HOLISTIC_TOTAL_LANDMARKS} · Pose{" "}
          {summary.poseCount}/33 · Face {summary.faceCount}/468 · Hands{" "}
          {summary.leftHandCount + summary.rightHandCount}/42 · 身體覆蓋{" "}
          {Math.round(summary.bodyCoverage * 100)}% · 肩線{" "}
          {Math.abs(summary.shoulderTilt).toFixed(1)}%
        </span>
      </div>

      {error ? <p className="camera-error">{error}</p> : null}

      <div className="camera-actions">
        <button
          className="primary-action"
          type="button"
          onClick={isRunning ? stopCamera : startCamera}
          disabled={status === "loading"}
          data-testid="camera-toggle"
        >
          {isRunning ? (
            <VideoOff size={17} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Camera size={17} strokeWidth={2} aria-hidden="true" />
          )}
          {isRunning ? "關閉鏡頭" : "開啟鏡頭"}
        </button>
      </div>

      <p className="privacy-note">
        <ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />
        目前影像只在瀏覽器本機進行姿勢定位，不會上傳。Pose Landmarker
        只能確認身體大區域，精準穴位仍以 3D 指引與比例尺為主。
      </p>
    </section>
  );
}

function createIdleSummary(targetLabel?: string): PoseSummary {
  return {
    poseCount: 0,
    faceCount: 0,
    leftHandCount: 0,
    rightHandCount: 0,
    totalCount: 0,
    instruction: targetLabel
      ? `開啟鏡頭後，請讓 ${targetLabel} 附近進入畫面`
      : "開啟鏡頭後，請讓上半身或全身進入畫面",
    shoulderTilt: 0,
    bodyCoverage: 0,
  };
}

function statusLabel(status: TrackingStatus) {
  if (status === "loading") {
    return "載入中";
  }
  if (status === "running") {
    return "定位中";
  }
  if (status === "error") {
    return "需處理";
  }
  return "待啟動";
}

function formatCameraError(errorValue: unknown) {
  if (!(errorValue instanceof Error)) {
    return "相機啟動失敗。";
  }

  if (errorValue.name === "NotAllowedError" || errorValue.message.includes("Permission")) {
    return "相機權限已被拒絕。請在瀏覽器網址列的網站權限中允許相機後再試一次。";
  }

  if (errorValue.name === "NotFoundError") {
    return "找不到可用的相機裝置。";
  }

  return errorValue.message || "相機啟動失敗。";
}

function syncCanvasSize(canvas: HTMLCanvasElement, preview: HTMLDivElement) {
  const rect = preview.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function drawCameraFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cover = getCoverRect(canvas, video);

  ctx.save();
  ctx.translate(cover.x + cover.width, cover.y);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, cover.width, cover.height);
  ctx.restore();
}

function drawHolistic(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: CombinedLandmarkResult,
  targetPointId?: string,
  targetLabel?: string,
) {
  const cover = getCoverRect(canvas, video);
  drawPoseLandmarks(ctx, result.poseLandmarks[0], cover);
  drawFaceLandmarks(ctx, result.faceLandmarks[0]?.slice(0, FACE_LANDMARK_COUNT), cover);
  drawHandLandmarks(ctx, result.leftHandLandmarks[0], cover, "#2f6f60");
  drawHandLandmarks(ctx, result.rightHandLandmarks[0], cover, "#111412");

  const target = targetPointId ? getBodyTargetPoint(result, cover, targetPointId) : undefined;
  if (target) {
    drawTargetMarker(ctx, target, targetLabel);
  }
}

function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | undefined,
  cover: CoverRect,
) {
  if (!landmarks) {
    return;
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(47, 111, 96, 0.84)";

  PoseLandmarker.POSE_CONNECTIONS.forEach((connection) => {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!isVisible(start) || !isVisible(end)) {
      return;
    }

    const startPoint = landmarkToCanvas(start, cover);
    const endPoint = landmarkToCanvas(end, cover);
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  });

  landmarks.forEach((landmark, index) => {
    if (!isVisible(landmark)) {
      return;
    }

    const point = landmarkToCanvas(landmark, cover);
    const isCore = CORE_LANDMARKS.includes(index);
    ctx.beginPath();
    ctx.arc(point.x, point.y, isCore ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isCore ? "#111412" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(47, 111, 96, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | undefined,
  cover: CoverRect,
) {
  if (!landmarks) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(47, 111, 96, 0.42)";
  ctx.lineWidth = 1.6;

  FACE_CONNECTION_GROUPS.forEach((connections) => {
    connections.forEach((connection) => {
      const start = landmarks[connection.start];
      const end = landmarks[connection.end];
      if (!start || !end) {
        return;
      }

      const startPoint = landmarkToCanvas(start, cover);
      const endPoint = landmarkToCanvas(end, cover);
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      ctx.lineTo(endPoint.x, endPoint.y);
      ctx.stroke();
    });
  });

  ctx.fillStyle = "rgba(47, 111, 96, 0.52)";
  landmarks.forEach((landmark, index) => {
    if (index % 2 !== 0) {
      return;
    }
    const point = landmarkToCanvas(landmark, cover);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.35, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawHandLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[] | undefined,
  cover: CoverRect,
  color: string,
) {
  if (!landmarks) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  HandLandmarker.HAND_CONNECTIONS.forEach((connection) => {
    const start = landmarks[connection.start];
    const end = landmarks[connection.end];
    if (!start || !end) {
      return;
    }

    const startPoint = landmarkToCanvas(start, cover);
    const endPoint = landmarkToCanvas(end, cover);
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  });

  landmarks.forEach((landmark, index) => {
    const point = landmarkToCanvas(landmark, cover);
    const isWrist = index === 0;
    ctx.beginPath();
    ctx.arc(point.x, point.y, isWrist ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isWrist ? color : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  });
  ctx.restore();
}

function getBodyTargetPoint(
  result: CombinedLandmarkResult,
  cover: CoverRect,
  targetPointId: string,
) {
  const pose = result.poseLandmarks[0];
  const leftHand = result.leftHandLandmarks[0];
  const rightHand = result.rightHandLandmarks[0];

  if (targetPointId === "hegu") {
    return handPoint(leftHand, 2, 5, 0.55, cover) ?? handPoint(rightHand, 2, 5, 0.55, cover);
  }

  if (targetPointId === "neiguan") {
    return neiguanPoint(leftHand, cover) ?? neiguanPoint(rightHand, cover);
  }

  if (targetPointId === "quchi") {
    return posePoint(pose?.[13], cover) ?? posePoint(pose?.[14], cover);
  }

  if (targetPointId === "zusanli") {
    return legOffsetPoint(pose?.[25], pose?.[27], cover) ?? legOffsetPoint(pose?.[26], pose?.[28], cover);
  }

  return undefined;
}

function drawTargetMarker(
  ctx: CanvasRenderingContext2D,
  target: CanvasPoint,
  targetLabel?: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(target.x, target.y, 18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(247, 247, 244, 0.64)";
  ctx.fill();
  ctx.strokeStyle = "#111412";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#2f6f60";
  ctx.fill();

  if (targetLabel) {
    const label = targetLabel.split(" - ")[0] ?? targetLabel;
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const width = ctx.measureText(label).width + 18;
    const labelX = Math.min(target.x + 24, ctx.canvas.width - width - 12);
    const labelY = Math.max(24, target.y - 24);
    ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    roundRect(ctx, labelX, labelY - 15, width, 30, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(18, 20, 17, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#111412";
    ctx.fillText(label, labelX + 9, labelY);
  }

  ctx.restore();
}

function handPoint(
  landmarks: NormalizedLandmark[] | undefined,
  firstIndex: number,
  secondIndex: number,
  amount: number,
  cover: CoverRect,
) {
  const first = landmarks?.[firstIndex];
  const second = landmarks?.[secondIndex];
  if (!first || !second) {
    return undefined;
  }

  return landmarkToCanvas(interpolateLandmark(first, second, amount), cover);
}

function neiguanPoint(landmarks: NormalizedLandmark[] | undefined, cover: CoverRect) {
  const wrist = landmarks?.[0];
  const middle = landmarks?.[9];
  if (!wrist || !middle) {
    return undefined;
  }

  return landmarkToCanvas(
    {
      x: wrist.x - (middle.x - wrist.x) * 0.65,
      y: wrist.y - (middle.y - wrist.y) * 0.65,
      z: wrist.z - ((middle.z ?? 0) - (wrist.z ?? 0)) * 0.65,
      visibility: Math.min(wrist.visibility ?? 1, middle.visibility ?? 1),
    },
    cover,
  );
}

function posePoint(landmark: NormalizedLandmark | undefined, cover: CoverRect) {
  if (!landmark || !isVisible(landmark)) {
    return undefined;
  }

  return landmarkToCanvas(landmark, cover);
}

function legOffsetPoint(
  knee: NormalizedLandmark | undefined,
  ankle: NormalizedLandmark | undefined,
  cover: CoverRect,
) {
  if (!knee || !ankle || !isVisible(knee) || !isVisible(ankle)) {
    return undefined;
  }

  return landmarkToCanvas(interpolateLandmark(knee, ankle, 0.28), cover);
}

function interpolateLandmark(
  first: NormalizedLandmark,
  second: NormalizedLandmark,
  amount: number,
): NormalizedLandmark {
  return {
    x: first.x + (second.x - first.x) * amount,
    y: first.y + (second.y - first.y) * amount,
    z: (first.z ?? 0) + ((second.z ?? 0) - (first.z ?? 0)) * amount,
    visibility: Math.min(first.visibility ?? 1, second.visibility ?? 1),
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function getCoverRect(canvas: HTMLCanvasElement, video: HTMLVideoElement): CoverRect {
  const videoWidth = video.videoWidth || canvas.width;
  const videoHeight = video.videoHeight || canvas.height;
  const scale = Math.max(canvas.width / videoWidth, canvas.height / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;

  return {
    x: (canvas.width - width) / 2,
    y: (canvas.height - height) / 2,
    width,
    height,
  };
}

function landmarkToCanvas(landmark: NormalizedLandmark, cover: CoverRect) {
  return {
    x: cover.x + (1 - landmark.x) * cover.width,
    y: cover.y + landmark.y * cover.height,
  };
}

function detectCombinedLandmarks(
  landmarkers: CombinedLandmarkers,
  video: HTMLVideoElement,
  timestamp: number,
): CombinedLandmarkResult {
  const poseResult = landmarkers.pose.detectForVideo(video, timestamp);
  const faceResult = landmarkers.face.detectForVideo(video, timestamp);
  const handResult = landmarkers.hands.detectForVideo(video, timestamp);
  const hands = splitHandsBySide(handResult.landmarks, handResult.handedness);

  return {
    poseLandmarks: poseResult.landmarks,
    faceLandmarks: faceResult.faceLandmarks,
    leftHandLandmarks: hands.left,
    rightHandLandmarks: hands.right,
  };
}

function splitHandsBySide(
  hands: NormalizedLandmark[][],
  handedness: { categoryName?: string }[][],
) {
  const left: NormalizedLandmark[][] = [];
  const right: NormalizedLandmark[][] = [];

  hands.forEach((hand, index) => {
    const side = handedness[index]?.[0]?.categoryName;
    if (side === "Right") {
      right.push(hand);
      return;
    }

    left.push(hand);
  });

  return { left, right };
}

function closeLandmarkers(landmarkers: CombinedLandmarkers | null) {
  landmarkers?.pose.close();
  landmarkers?.face.close();
  landmarkers?.hands.close();
}

function analyzeHolistic(
  result: CombinedLandmarkResult,
  targetLabel?: string,
): PoseSummary {
  const poseLandmarks = result.poseLandmarks[0];
  const faceLandmarks = result.faceLandmarks[0]?.slice(0, FACE_LANDMARK_COUNT) ?? [];
  const leftHandLandmarks = result.leftHandLandmarks[0] ?? [];
  const rightHandLandmarks = result.rightHandLandmarks[0] ?? [];

  if (!poseLandmarks?.length) {
    return {
      ...createIdleSummary(targetLabel),
      instruction: "請站到鏡頭前，讓身體進入畫面",
    };
  }

  const visible = poseLandmarks.filter(isVisible);
  if (!visible.length) {
    return {
      ...createIdleSummary(targetLabel),
      instruction: "目前看不到足夠的身體關鍵點",
    };
  }

  const coreVisible = CORE_LANDMARKS.filter((index) => isVisible(poseLandmarks[index]));
  const xs = visible.map((landmark) => landmark.x);
  const ys = visible.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bodyCoverage = clamp(Math.max(maxX - minX, maxY - minY), 0, 1);
  const shoulderTilt =
    poseLandmarks[11] && poseLandmarks[12]
      ? (poseLandmarks[11].y - poseLandmarks[12].y) * 100
      : 0;
  const centerX = (minX + maxX) / 2;

  let instruction = targetLabel
    ? `${targetLabel} 的身體區域已進入畫面`
    : "身體定位完成，可作為穴位指引的初步校正";

  if (coreVisible.length < 4) {
    instruction = "請退後一點，讓肩膀與髖部進入畫面";
  } else if (Math.abs(centerX - 0.5) > 0.15) {
    instruction = "請移到畫面中央";
  } else if (bodyCoverage < 0.42) {
    instruction = "可以稍微靠近鏡頭";
  } else if (bodyCoverage > 0.92) {
    instruction = "請稍微退後，避免身體超出畫面";
  }

  const poseCount = visible.length;
  const faceCount = faceLandmarks.length;
  const leftHandCount = leftHandLandmarks.length;
  const rightHandCount = rightHandLandmarks.length;

  return {
    poseCount,
    faceCount,
    leftHandCount,
    rightHandCount,
    totalCount: poseCount + faceCount + leftHandCount + rightHandCount,
    instruction,
    shoulderTilt,
    bodyCoverage,
  };
}

function isVisible(landmark?: NormalizedLandmark) {
  return Boolean(landmark && (landmark.visibility ?? 1) >= 0.52);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
