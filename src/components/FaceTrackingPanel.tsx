import {
  Check,
  Camera,
  Loader2,
  LocateFixed,
  MoveHorizontal,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import { getFaceAlignment, type FaceAlignmentState } from "../lib/faceAlignment";
import { faceAcupointLayouts } from "../lib/acupointTracking";
import { assetPath } from "../lib/assetPaths";

type TrackingStatus = "idle" | "loading" | "running" | "error";

type FaceSummary = {
  visibleCount: number;
  instruction: string;
  faceCoverage: number;
  centerOffset: number;
  alignment: FaceAlignmentState;
};

type FaceTrackingPanelProps = {
  targetPointId?: string;
  targetLabel?: string;
  onTargetContactChange?: (contact: boolean) => void;
};

type FaceAndHandLandmarkers = {
  face: FaceLandmarker;
  hands: HandLandmarker;
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

const WASM_ROOT = assetPath("mediapipe/wasm");
const FACE_MODEL_PATH = assetPath("models/mediapipe/face_landmarker.task");
const HAND_MODEL_PATH = assetPath("models/mediapipe/hand_landmarker.task");
const FACE_CONNECTION_GROUPS = [
  FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
  FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
  FaceLandmarker.FACE_LANDMARKS_LIPS,
];

export function FaceTrackingPanel({
  targetPointId,
  targetLabel,
  onTargetContactChange,
}: FaceTrackingPanelProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceAndHandLandmarkers | null>(null);
  const targetRef = useRef({ targetPointId, targetLabel });
  const contactRef = useRef(false);
  const onTargetContactChangeRef = useRef(onTargetContactChange);
  const frameRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastSummaryAtRef = useRef(0);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [summary, setSummary] = useState<FaceSummary>(() => createIdleSummary(targetLabel));
  const [error, setError] = useState("");

  const isRunning = status === "running";
  const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    targetRef.current = { targetPointId, targetLabel };
    updateTargetContact(false);
  }, [targetLabel, targetPointId]);

  useEffect(() => {
    onTargetContactChangeRef.current = onTargetContactChange;
  }, [onTargetContactChange]);

  useEffect(() => {
    if (!isRunning) {
      setSummary(createIdleSummary(targetLabel));
    }
  }, [isRunning, targetLabel]);

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.face.close();
      landmarkerRef.current?.hands.close();
      landmarkerRef.current = null;
    };
  }, []);

  async function ensureLandmarker() {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const [face, hands] = await Promise.all([
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
    const landmarkers = { face, hands };
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
      runFaceLoop(landmarker);
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
    updateTargetContact(false);
    setSummary(createIdleSummary(targetRef.current.targetLabel));
    setStatus("idle");
  }

  function runFaceLoop(landmarkers: FaceAndHandLandmarkers) {
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
        const timestamp = performance.now();
        const result = landmarkers.face.detectForVideo(video, timestamp);
        const handResult = landmarkers.hands.detectForVideo(video, timestamp);
        drawCameraFrame(ctx, canvas, video);
        const currentTarget = targetRef.current;
        const cover = getCoverRect(canvas, video);
        const target = currentTarget.targetPointId
          ? getTargetPoint(result.faceLandmarks[0] ?? [], cover, currentTarget.targetPointId)
          : undefined;
        const targetContact = detectFaceTargetContact(
          target,
          handResult.landmarks,
          cover,
          contactRef.current,
        );
        updateTargetContact(targetContact);
        drawFace(
          ctx,
          canvas,
          video,
          result,
          currentTarget.targetPointId,
          currentTarget.targetLabel,
          handResult.landmarks,
          targetContact,
        );
        lastVideoTimeRef.current = video.currentTime;
        updateSummary(result, canvas, video);
      }
    }

    frameRef.current = requestAnimationFrame(() => runFaceLoop(landmarkers));
  }

  function updateSummary(
    result: FaceLandmarkerResult,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
  ) {
    const now = performance.now();
    if (now - lastSummaryAtRef.current < 220) {
      return;
    }
    lastSummaryAtRef.current = now;
    setSummary(
      analyzeFace(result.faceLandmarks[0], canvas, video, targetRef.current.targetLabel),
    );
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function updateTargetContact(contact: boolean) {
    if (contactRef.current === contact) {
      return;
    }
    contactRef.current = contact;
    onTargetContactChangeRef.current?.(contact);
  }

  return (
    <section
      className="camera-panel camera-panel-face"
      aria-label="臉部 AR 穴位定位"
      data-testid="face-tracking-panel"
      data-target-point-id={targetPointId ?? ""}
    >
      <div className="camera-panel-head">
        <div>
          <p className="eyebrow">MediaPipe Face</p>
          <h2>{targetLabel ? "臉部 AR 穴位定位" : "臉部鏡頭定位"}</h2>
        </div>
        <div
          className={`camera-state camera-state-${status}`}
          data-testid="face-camera-state"
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
          aria-label="臉部相機來源"
        />
        <canvas ref={canvasRef} aria-hidden="true" />
        {!isRunning ? (
          <div className="camera-placeholder">
            <Camera size={30} strokeWidth={1.6} aria-hidden="true" />
            <span>相機尚未開啟</span>
          </div>
        ) : null}
        {isRunning ? (
          <div
            className={`face-alignment-guide face-alignment-${summary.alignment}`}
            role="status"
            aria-live="polite"
          >
            {alignmentIcon(summary.alignment)}
            <span>{summary.instruction}</span>
          </div>
        ) : null}
      </div>

      <div className="pose-readout">
        <strong>{summary.instruction}</strong>
        <span>
          臉部點 {summary.visibleCount}/478 · 臉部覆蓋{" "}
          {Math.round(summary.faceCoverage * 100)}% · 偏移{" "}
          {Math.abs(summary.centerOffset).toFixed(1)}%
        </span>
      </div>

      {error ? <p className="camera-error">{error}</p> : null}

      <div className="camera-actions">
        <button
          className="primary-action"
          type="button"
          onClick={isRunning ? stopCamera : startCamera}
          disabled={status === "loading"}
          data-testid="face-camera-toggle"
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
        目前影像只在瀏覽器本機進行臉部定位，不會上傳。這版先以臉框比例標示穴位區域，精準點位後續會接穴位資料表與校正寸距。
      </p>
    </section>
  );
}

function createIdleSummary(targetLabel?: string): FaceSummary {
  return {
    visibleCount: 0,
    instruction: targetLabel
      ? `開啟鏡頭後，請讓 ${targetLabel} 附近清楚入鏡`
      : "開啟鏡頭後，請讓臉部正面進入畫面",
    faceCoverage: 0,
    centerOffset: 0,
    alignment: "searching",
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
    return "相機權限已被拒絕，已切換為 3D 與文字備援 Demo。可依右側模型完成流程。";
  }

  if (errorValue.name === "NotFoundError") {
    return "找不到可用的相機裝置，已切換為 3D 與文字備援 Demo。";
  }

  return errorValue.message || "相機啟動失敗，已切換為 3D 與文字備援 Demo。";
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

function drawFace(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: FaceLandmarkerResult,
  targetPointId?: string,
  targetLabel?: string,
  handLandmarks: NormalizedLandmark[][] = [],
  targetContact = false,
) {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) {
    return;
  }

  const cover = getCoverRect(canvas, video);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(47, 111, 96, 0.72)";
  ctx.lineWidth = 2.5;

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

  handLandmarks.forEach((hand) => drawFaceHandLandmarks(ctx, hand, cover));

  const target = targetPointId ? getTargetPoint(landmarks, cover, targetPointId) : undefined;
  if (target) {
    if (targetContact) {
      ctx.save();
      ctx.fillStyle = "rgba(10, 18, 14, 0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    drawTargetMarker(ctx, target, targetLabel, targetContact);
  }
}

function drawFaceHandLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  cover: CoverRect,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(18, 20, 17, 0.82)";
  ctx.lineWidth = 2.2;
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
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === 8 ? 5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = index === 8 ? "#2f6f60" : "#ffffff";
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function detectFaceTargetContact(
  target: CanvasPoint | undefined,
  hands: NormalizedLandmark[][],
  cover: CoverRect,
  wasContacting: boolean,
) {
  if (!target) {
    return false;
  }

  const fingertips = hands
    .flatMap((hand) => [hand[8], hand[12]])
    .filter((landmark): landmark is NormalizedLandmark => Boolean(landmark))
    .map((landmark) => landmarkToCanvas(landmark, cover));
  const baseThreshold = Math.max(24, Math.min(cover.width, cover.height) * 0.045);
  const threshold = wasContacting ? baseThreshold * 1.35 : baseThreshold;

  return fingertips.some(
    (fingertip) => Math.hypot(fingertip.x - target.x, fingertip.y - target.y) <= threshold,
  );
}

function drawTargetMarker(
  ctx: CanvasRenderingContext2D,
  target: CanvasPoint,
  targetLabel?: string,
  contact = false,
) {
  ctx.save();
  const pulse = contact ? 4 + Math.sin(performance.now() / 110) * 3 : 0;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 17 + pulse, 0, Math.PI * 2);
  ctx.fillStyle = contact ? "rgba(47, 111, 96, 0.82)" : "rgba(247, 247, 244, 0.62)";
  ctx.fill();
  ctx.strokeStyle = contact ? "#ffffff" : "#111412";
  ctx.lineWidth = contact ? 3.5 : 2.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(target.x, target.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = contact ? "#ffffff" : "#2f6f60";
  ctx.fill();

  if (targetLabel) {
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const label = targetLabel.split(" - ")[0] ?? targetLabel;
    const width = ctx.measureText(label).width + 18;
    const labelX = target.x + 23;
    const labelY = target.y - 22;
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
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

function analyzeFace(
  landmarks: NormalizedLandmark[] | undefined,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  targetLabel?: string,
): FaceSummary {
  if (!landmarks?.length) {
    return {
      ...createIdleSummary(targetLabel),
      instruction: "請讓臉部進入畫面",
    };
  }

  const cover = getCoverRect(canvas, video);
  const box = getCanvasLandmarkBox(landmarks, cover);
  const faceCoverage = clamp(Math.max(box.width / canvas.width, box.height / canvas.height), 0, 1);
  const centerOffset = ((box.x + box.width / 2 - canvas.width / 2) / canvas.width) * 100;
  const faceAlignment = getFaceAlignment(landmarks);

  let instruction = faceAlignment.instruction;
  let alignment = faceAlignment.state;

  if (Math.abs(centerOffset) > 11) {
    instruction = "請把臉移到畫面中央";
    alignment = "position";
  } else if (faceCoverage < 0.32) {
    instruction = "可以稍微靠近鏡頭";
    alignment = "position";
  } else if (faceCoverage > 0.88) {
    instruction = "請稍微退後，避免臉部超出畫面";
    alignment = "position";
  } else if (faceAlignment.state === "aligned" && targetLabel) {
    instruction = `${targetLabel} 已對準，可開始按壓`;
  }

  return {
    visibleCount: landmarks.length,
    instruction,
    faceCoverage,
    centerOffset,
    alignment,
  };
}

function alignmentIcon(alignment: FaceAlignmentState) {
  if (alignment === "turn") {
    return <MoveHorizontal size={18} strokeWidth={2} aria-hidden="true" />;
  }
  if (alignment === "level") {
    return <RotateCcw size={18} strokeWidth={2} aria-hidden="true" />;
  }
  if (alignment === "aligned") {
    return <Check size={18} strokeWidth={2.2} aria-hidden="true" />;
  }
  return <ScanFace size={18} strokeWidth={2} aria-hidden="true" />;
}

function getTargetPoint(
  landmarks: NormalizedLandmark[],
  cover: CoverRect,
  targetPointId: string,
) {
  const layout = faceAcupointLayouts[targetPointId];
  if (!layout) {
    return undefined;
  }

  const box = getCanvasLandmarkBox(landmarks, cover);
  return {
    x: box.x + box.width * layout.x,
    y: box.y + box.height * layout.y,
  };
}

function getCanvasLandmarkBox(landmarks: NormalizedLandmark[], cover: CoverRect) {
  const points = landmarks.map((landmark) => landmarkToCanvas(landmark, cover));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
