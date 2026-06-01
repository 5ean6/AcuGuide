import {
  ArrowLeft,
  Camera,
  Check,
  Hand,
  Loader2,
  LocateFixed,
  Ruler,
  ShieldCheck,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import type { CunCalibration } from "../types";

type CalibrationStepProps = {
  calibration: CunCalibration;
  onCalibrationChange: (value: CunCalibration) => void;
  onBack: () => void;
  onDone: () => void;
};

type CalibrationStatus = "idle" | "loading" | "running" | "error";

type CoverRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HandMeasure = {
  visibleCount: number;
  palmSpanPx: number;
  pixelsPerCun: number;
  confidence: number;
  instruction: string;
};

const WASM_ROOT = "/mediapipe/wasm";
const HAND_MODEL_PATH = "/models/mediapipe/hand_landmarker.task";
const INDEX_MCP = 5;
const PINKY_MCP = 17;
const HIGHLIGHT_LANDMARKS = [INDEX_MCP, PINKY_MCP];

export function CalibrationStep({
  calibration,
  onCalibrationChange,
  onBack,
  onDone,
}: CalibrationStepProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const frameRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastMeasureAtRef = useRef(0);
  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [measure, setMeasure] = useState<HandMeasure>(() =>
    createMeasureFromCalibration(calibration),
  );
  const [error, setError] = useState("");

  const isRunning = status === "running";
  const canUseCamera = Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    if (!isRunning) {
      setMeasure(createMeasureFromCalibration(calibration));
    }
  }, [calibration, isRunning]);

  useEffect(() => {
    return () => {
      stopCamera();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  async function ensureLandmarker() {
    if (landmarkerRef.current) {
      return landmarkerRef.current;
    }

    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_MODEL_PATH,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
    landmarkerRef.current = landmarker;
    return landmarker;
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
        throw new Error("找不到手部校正預覽元件。");
      }

      video.srcObject = stream;
      await video.play();
      setStatus("running");
      lastVideoTimeRef.current = -1;
      runHandLoop(landmarker);
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
    setStatus("idle");
  }

  function runHandLoop(landmarker: HandLandmarker) {
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
        const result = landmarker.detectForVideo(video, performance.now());
        drawCameraFrame(ctx, canvas, video);
        drawHand(ctx, canvas, video, result);
        updateMeasure(result, canvas, video);
        lastVideoTimeRef.current = video.currentTime;
      }
    }

    frameRef.current = requestAnimationFrame(() => runHandLoop(landmarker));
  }

  function updateMeasure(
    result: HandLandmarkerResult,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
  ) {
    const now = performance.now();
    if (now - lastMeasureAtRef.current < 180) {
      return;
    }
    lastMeasureAtRef.current = now;

    const nextMeasure = analyzeHand(result.landmarks[0], canvas, video);
    setMeasure(nextMeasure);

    if (nextMeasure.confidence > 0.18) {
      onCalibrationChange({
        pixelsPerCun: nextMeasure.pixelsPerCun,
        palmSpanPx: nextMeasure.palmSpanPx,
        confidence: nextMeasure.confidence,
        method: "hand_landmarker",
        updatedAt: Date.now(),
      });
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleManualChange(value: number) {
    onCalibrationChange({
      pixelsPerCun: value,
      palmSpanPx: value * 3,
      confidence: 0.32,
      method: "manual",
      updatedAt: Date.now(),
    });
  }

  return (
    <main className="calibration-view">
      <section className="calibration-copy" aria-labelledby="calibration-title">
        <p className="eyebrow">Step 01</p>
        <h1 id="calibration-title">手部比例尺校正</h1>
        <p className="subtle-text">
          目前 1 寸 ≈ {Math.round(calibration.pixelsPerCun)} px
        </p>
        <p className="calibration-help">
          張開手掌放進畫面，用 MediaPipe 抓食指與小指掌指關節，先以四指寬約 3
          寸建立像素比例。
        </p>
      </section>

      <section
        className="hand-calibration-stage"
        aria-label="手部鏡頭校正區"
        data-testid="hand-calibration-panel"
      >
        <div className="camera-panel-head">
          <div>
            <p className="eyebrow">MediaPipe Hand</p>
            <h2>掌寬像素定位</h2>
          </div>
          <div className={`camera-state camera-state-${status}`}>
            {status === "loading" ? (
              <Loader2 size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <LocateFixed size={14} strokeWidth={2} aria-hidden="true" />
            )}
            {statusLabel(status)}
          </div>
        </div>

        <div className="hand-camera-preview" ref={previewRef}>
          <div className="hand-frame-corners" aria-hidden="true" />
          <video
            className="camera-source"
            ref={videoRef}
            muted
            playsInline
            aria-label="手部校正相機來源"
          />
          <canvas ref={canvasRef} aria-hidden="true" />
          {!isRunning ? (
            <div className="camera-placeholder">
              <Hand size={54} strokeWidth={1.3} aria-hidden="true" />
              <span>開啟鏡頭後，手掌對準框線</span>
            </div>
          ) : null}
        </div>

        <div className="pose-readout">
          <strong>{measure.instruction}</strong>
          <span>
            可見點 {measure.visibleCount}/21 · 四指寬{" "}
            {Math.round(measure.palmSpanPx)} px · 信心{" "}
            {Math.round(measure.confidence * 100)}%
          </span>
        </div>

        {error ? <p className="camera-error">{error}</p> : null}

        <div className="camera-actions">
          <button
            className="primary-action"
            type="button"
            onClick={isRunning ? stopCamera : startCamera}
            disabled={status === "loading"}
            data-testid="hand-camera-toggle"
          >
            {isRunning ? (
              <VideoOff size={17} strokeWidth={2} aria-hidden="true" />
            ) : (
              <Camera size={17} strokeWidth={2} aria-hidden="true" />
            )}
            {isRunning ? "停止校正" : "開啟鏡頭校正"}
          </button>
        </div>
      </section>

      <section className="calibration-metrics" aria-label="寸比例結果">
        <div className="metric-grid">
          <div className="metric-card">
            <span>1 寸</span>
            <strong>{Math.round(calibration.pixelsPerCun)} px</strong>
          </div>
          <div className="metric-card">
            <span>四指寬</span>
            <strong>{Math.round(calibration.palmSpanPx)} px</strong>
          </div>
          <div className="metric-card">
            <span>校正來源</span>
            <strong>{calibration.method === "hand_landmarker" ? "鏡頭" : "手動"}</strong>
          </div>
        </div>

        <label className="manual-cun-control">
          <span>
            <Ruler size={16} strokeWidth={1.9} aria-hidden="true" />
            手動微調 1 寸像素
          </span>
          <input
            aria-label="手動微調一寸像素"
            type="range"
            min="20"
            max="180"
            step="1"
            value={Math.round(calibration.pixelsPerCun)}
            onChange={(event) => handleManualChange(Number(event.target.value))}
          />
        </label>

        <p className="privacy-note">
          <ShieldCheck size={14} strokeWidth={1.9} aria-hidden="true" />
          影像只在瀏覽器本機處理。這版是比例尺原型，後續可以改成依性別、手型或實測標尺校準。
        </p>
      </section>

      <div className="calibration-actions">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
          返回
        </button>
        <button
          className="primary-action"
          type="button"
          onClick={onDone}
          data-testid="calibration-done"
        >
          完成校正
          <Check size={17} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </main>
  );
}

function createMeasureFromCalibration(calibration: CunCalibration): HandMeasure {
  return {
    visibleCount: 0,
    palmSpanPx: calibration.palmSpanPx,
    pixelsPerCun: calibration.pixelsPerCun,
    confidence: calibration.confidence,
    instruction:
      calibration.method === "hand_landmarker"
        ? "已套用上一筆手部鏡頭校正"
        : "尚未開啟鏡頭，先使用預設比例",
  };
}

function statusLabel(status: CalibrationStatus) {
  if (status === "loading") {
    return "載入中";
  }
  if (status === "running") {
    return "校正中";
  }
  if (status === "error") {
    return "需處理";
  }
  return "待啟動";
}

function formatCameraError(errorValue: unknown) {
  if (!(errorValue instanceof Error)) {
    return "手部校正鏡頭啟動失敗。";
  }

  if (errorValue.name === "NotAllowedError" || errorValue.message.includes("Permission")) {
    return "相機權限已被拒絕。請在瀏覽器網址列允許相機後再試一次。";
  }

  if (errorValue.name === "NotFoundError") {
    return "找不到可用的相機裝置。";
  }

  return errorValue.message || "手部校正鏡頭啟動失敗。";
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

function drawHand(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: HandLandmarkerResult,
) {
  const landmarks = result.landmarks[0];
  if (!landmarks) {
    return;
  }

  const cover = getCoverRect(canvas, video);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(47, 111, 96, 0.78)";

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

  const indexPoint = landmarkToCanvas(landmarks[INDEX_MCP], cover);
  const pinkyPoint = landmarkToCanvas(landmarks[PINKY_MCP], cover);
  ctx.beginPath();
  ctx.moveTo(indexPoint.x, indexPoint.y);
  ctx.lineTo(pinkyPoint.x, pinkyPoint.y);
  ctx.strokeStyle = "#111412";
  ctx.lineWidth = 4;
  ctx.stroke();

  landmarks.forEach((landmark, index) => {
    const point = landmarkToCanvas(landmark, cover);
    const isHighlight = HIGHLIGHT_LANDMARKS.includes(index);
    ctx.beginPath();
    ctx.arc(point.x, point.y, isHighlight ? 7 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isHighlight ? "#111412" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(47, 111, 96, 0.95)";
    ctx.lineWidth = isHighlight ? 2.5 : 1.75;
    ctx.stroke();
  });
}

function analyzeHand(
  landmarks: NormalizedLandmark[] | undefined,
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
): HandMeasure {
  if (!landmarks?.length) {
    return {
      visibleCount: 0,
      palmSpanPx: 0,
      pixelsPerCun: 64,
      confidence: 0,
      instruction: "請將手掌放進框線內，手指自然張開",
    };
  }

  const visibleCount = landmarks.length;
  const cover = getCoverRect(canvas, video);
  const index = landmarks[INDEX_MCP];
  const pinky = landmarks[PINKY_MCP];

  if (!index || !pinky) {
    return {
      visibleCount,
      palmSpanPx: 0,
      pixelsPerCun: 64,
      confidence: 0,
      instruction: "請讓食指到小指的掌指關節都進入畫面",
    };
  }

  const indexPoint = landmarkToCanvas(index, cover);
  const pinkyPoint = landmarkToCanvas(pinky, cover);
  const palmSpanPx = distance(indexPoint, pinkyPoint);
  const pixelsPerCun = clamp(palmSpanPx / 3, 20, 180);
  const confidence = clamp((palmSpanPx - 52) / 120, 0, 1);

  let instruction = "已抓到四指寬，可以完成校正";
  if (confidence < 0.28) {
    instruction = "手掌太小或太遠，請靠近一點";
  } else if (confidence < 0.52) {
    instruction = "比例可用，手掌再靠近會更穩";
  }

  return {
    visibleCount,
    palmSpanPx,
    pixelsPerCun,
    confidence,
    instruction,
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

function distance(
  a: {
    x: number;
    y: number;
  },
  b: {
    x: number;
    y: number;
  },
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
