import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AcupointGeometry } from "../types";
import { getAcupointGeometry } from "../data/acupointGeometry";
import { createBodyRegionPick } from "../lib/bodyRegions";
import { assetPath } from "../lib/assetPaths";
import type { BodyRegionPick, FeatureModeId, PointMatch, SymptomMarker } from "../types";

type AnatomyViewerProps = {
  mode: FeatureModeId;
  points: PointMatch[];
  activePointId?: string;
  focusPointId?: string;
  autoRotate?: boolean;
  symptomMarker?: SymptomMarker;
  symptomTone?: "default" | "complete";
  focusSymptomMarker?: boolean;
  regionSelectionEnabled?: boolean;
  onPointSelect?: (id: string) => void;
  onBodyRegionSelect?: (region: BodyRegionPick) => void;
};

type DragState = {
  active: boolean;
  moved: boolean;
  x: number;
  y: number;
};

type ModelConfig = {
  path: string;
  title: string;
  author: string;
  source: string;
  license: string;
  targetHeight: number;
  centerY: number;
};

type MarkerRecord = {
  pointId: string;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  anchor: THREE.Vector3;
  surfaceDirection: THREE.Vector3;
  projectionDistance?: number;
  snapToSurface?: boolean;
};

type ViewerState = {
  mode: FeatureModeId;
  modelRoot: THREE.Group;
  markerGroup: THREE.Group;
  markerMeshes: THREE.Object3D[];
  markerRecords: MarkerRecord[];
  symptomGroup: THREE.Group;
  symptomRecord: MarkerRecord | null;
  symptomPath: {
    anchors: THREE.Vector3[];
    direction: THREE.Vector3;
    projectionDistance?: number;
    mesh: THREE.Mesh;
  } | null;
  camera: THREE.PerspectiveCamera;
  materials: {
    marker: THREE.MeshStandardMaterial;
    markerActive: THREE.MeshStandardMaterial;
    markerRing: THREE.MeshStandardMaterial;
    markerRingActive: THREE.MeshStandardMaterial;
    symptom: THREE.MeshStandardMaterial;
  };
  model: THREE.Object3D | null;
  focusPointId?: string;
};

const markerColor = new THREE.Color("#f7f7f4");
const symptomMarkerColor = new THREE.Color("#2f6f60");
const completeSymptomMarkerColor = new THREE.Color("#d6b33f");
const completeSymptomEmissiveColor = new THREE.Color("#f1d978");
const softMaterialColor = new THREE.Color("#ddd7cc");
const markerRadius = {
  idle: 0.024,
  active: 0.033,
};
const markerRingRadius = {
  idle: 0.04,
  active: 0.052,
};
const modelConfigs: Record<FeatureModeId, ModelConfig> = {
  face: {
    path: assetPath("models/head/scene.gltf"),
    title: "human head by sculptgl",
    author: "Payzero",
    source:
      "https://sketchfab.com/3d-models/human-head-by-sculptgl-7f30d2b9f2394edab07b527dcdc993d8",
    license: "CC BY 4.0",
    targetHeight: 1.92,
    centerY: 0.2,
  },
  body: {
    path: assetPath("models/human/scene.gltf"),
    title: "Human",
    author: "aaron.kalvin",
    source: "https://sketchfab.com/3d-models/human-03a70758739544b3aa705c13af3872b1",
    license: "CC BY 4.0",
    targetHeight: 3.22,
    centerY: -0.12,
  },
  wellness: {
    path: assetPath("models/human/scene.gltf"),
    title: "Human",
    author: "aaron.kalvin",
    source: "https://sketchfab.com/3d-models/human-03a70758739544b3aa705c13af3872b1",
    license: "CC BY 4.0",
    targetHeight: 3.22,
    centerY: -0.12,
  },
  other: {
    path: assetPath("models/human/scene.gltf"),
    title: "Human",
    author: "aaron.kalvin",
    source: "https://sketchfab.com/3d-models/human-03a70758739544b3aa705c13af3872b1",
    license: "CC BY 4.0",
    targetHeight: 3.22,
    centerY: -0.12,
  },
};
const initialModelRotation: Record<FeatureModeId, { x: number; y: number }> = {
  face: { x: 0, y: -0.28 },
  body: { x: 0, y: Math.PI + 0.2 },
  wellness: { x: 0, y: Math.PI + 0.2 },
  other: { x: 0, y: Math.PI + 0.2 },
};
const rememberedRotation = new Map<FeatureModeId, { x: number; y: number }>();

THREE.Cache.enabled = true;

export function AnatomyViewer({
  mode,
  points,
  activePointId,
  focusPointId,
  autoRotate = true,
  symptomMarker,
  symptomTone = "default",
  focusSymptomMarker = false,
  regionSelectionEnabled = false,
  onPointSelect,
  onBodyRegionSelect,
}: AnatomyViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onPointSelectRef = useRef(onPointSelect);
  const onBodyRegionSelectRef = useRef(onBodyRegionSelect);
  const regionSelectionEnabledRef = useRef(regionSelectionEnabled);
  const viewerStateRef = useRef<ViewerState | null>(null);
  const modelConfig = modelConfigs[mode];
  const isCompleteSymptomTone = symptomTone === "complete";

  useEffect(() => {
    onPointSelectRef.current = onPointSelect;
    onBodyRegionSelectRef.current = onBodyRegionSelect;
    regionSelectionEnabledRef.current = regionSelectionEnabled;
  }, [onBodyRegionSelect, onPointSelect, regionSelectionEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return undefined;
    }
    const viewerCanvas: HTMLCanvasElement = canvas;
    const viewerContainer: HTMLDivElement = container;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: viewerCanvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const isFaceMode = mode === "face";
    camera.position.set(0, isFaceMode ? 0.25 : 0.05, isFaceMode ? 5.2 : 4.8);

    const modelRoot = new THREE.Group();
    const rotation = rememberedRotation.get(mode) ?? initialModelRotation[mode];
    modelRoot.rotation.set(rotation.x, rotation.y, 0);
    scene.add(modelRoot);

    const materials = {
      skin: new THREE.MeshStandardMaterial({
        color: softMaterialColor,
        roughness: 0.74,
        metalness: 0.02,
      }),
      marker: new THREE.MeshStandardMaterial({
        color: markerColor,
        roughness: 0.3,
        metalness: 0.04,
        emissive: new THREE.Color("#d7eee4"),
        emissiveIntensity: 0.1,
      }),
      markerActive: new THREE.MeshStandardMaterial({
        color: markerColor,
        roughness: 0.26,
        metalness: 0.04,
        emissive: new THREE.Color("#ffffff"),
        emissiveIntensity: 0.16,
      }),
      markerRing: new THREE.MeshStandardMaterial({
        color: markerColor,
        roughness: 0.32,
        metalness: 0.02,
      }),
      markerRingActive: new THREE.MeshStandardMaterial({
        color: markerColor,
        roughness: 0.25,
        metalness: 0.04,
      }),
      symptom: new THREE.MeshStandardMaterial({
        color: isCompleteSymptomTone ? completeSymptomMarkerColor : symptomMarkerColor,
        roughness: 0.24,
        metalness: 0.03,
        emissive: isCompleteSymptomTone
          ? completeSymptomEmissiveColor
          : new THREE.Color("#72b49e"),
        emissiveIntensity: isCompleteSymptomTone ? 0.68 : 0.45,
      }),
    };

    const markerMeshes: THREE.Object3D[] = [];
    const markerRecords: MarkerRecord[] = [];
    const markerGroup = new THREE.Group();
    markerGroup.visible = false;
    modelRoot.add(markerGroup);
    const symptomGroup = new THREE.Group();
    symptomGroup.visible = false;
    modelRoot.add(symptomGroup);

    const viewerState: ViewerState = {
      mode,
      modelRoot,
      markerGroup,
      markerMeshes,
      markerRecords,
      symptomGroup,
      symptomRecord: null,
      symptomPath: null,
      camera,
      materials: {
        marker: materials.marker,
        markerActive: materials.markerActive,
        markerRing: materials.markerRing,
        markerRingActive: materials.markerRingActive,
        symptom: materials.symptom,
      },
      model: null,
      focusPointId,
    };
    viewerStateRef.current = viewerState;

    const loader = new GLTFLoader();
    let cancelled = false;
    loader.load(
      modelConfig.path,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        prepareLoadedModel(gltf.scene, materials.skin);
        fitModelToViewer(gltf.scene, modelConfig);
        modelRoot.add(gltf.scene);
        viewerState.model = gltf.scene;
        snapMarkersToModelSurface(modelRoot, markerGroup, gltf.scene, markerRecords);
        snapSymptomMarker(viewerState, gltf.scene);
      },
      undefined,
      () => {
        if (!cancelled) {
          const fallbackModel = createFallbackModel(modelRoot, materials.skin, mode);
          viewerState.model = fallbackModel;
          snapMarkersToModelSurface(modelRoot, markerGroup, fallbackModel, markerRecords);
          snapSymptomMarker(viewerState, fallbackModel);
        }
      },
    );

    const ambient = new THREE.HemisphereLight("#ffffff", "#e3e0d4", 2.25);
    const key = new THREE.DirectionalLight("#ffffff", 2.6);
    key.position.set(2.8, 3.2, 3.8);
    const rim = new THREE.DirectionalLight("#d7eee4", 1.15);
    rim.position.set(-3, 1.8, -2.5);
    scene.add(ambient, key, rim);

    const drag: DragState = { active: false, moved: false, x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function resize() {
      const rect = viewerContainer.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      camera.lookAt(0, isFaceMode ? 0.22 : 0.03, 0);
    }

    function pickPoint(event: PointerEvent) {
      const rect = viewerCanvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(markerMeshes, false);
      const pointId = hits[0]?.object.userData.pointId as string | undefined;
      if (pointId) {
        onPointSelectRef.current?.(pointId);
        return;
      }

      if (!regionSelectionEnabledRef.current || !viewerState.model) {
        return;
      }

      const bodyHit = raycaster.intersectObject(viewerState.model, true)[0];
      if (!bodyHit) {
        return;
      }

      const localPosition = modelRoot.worldToLocal(bodyHit.point.clone());
      onBodyRegionSelectRef.current?.(
        createBodyRegionPick({
          x: localPosition.x,
          y: localPosition.y,
          z: localPosition.z,
        }),
      );
    }

    function handlePointerDown(event: PointerEvent) {
      drag.active = true;
      drag.moved = false;
      drag.x = event.clientX;
      drag.y = event.clientY;
      viewerCanvas.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!drag.active) {
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        drag.moved = true;
      }

      modelRoot.rotation.y += dx * 0.007;
      modelRoot.rotation.x = THREE.MathUtils.clamp(
        modelRoot.rotation.x + dy * 0.004,
        -0.35,
        0.35,
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
    }

    function handlePointerUp(event: PointerEvent) {
      if (!drag.moved) {
        pickPoint(event);
      }
      drag.active = false;
      viewerCanvas.releasePointerCapture(event.pointerId);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(viewerContainer);
    resize();

    viewerCanvas.addEventListener("pointerdown", handlePointerDown);
    viewerCanvas.addEventListener("pointermove", handlePointerMove);
    viewerCanvas.addEventListener("pointerup", handlePointerUp);

    let disposed = false;
    let frame = 0;
    function animate() {
      if (disposed) {
        return;
      }

      frame = requestAnimationFrame(animate);
      const focusRecord = viewerState.focusPointId
        ? viewerState.markerRecords.find((marker) => marker.pointId === viewerState.focusPointId)
        : undefined;
      const focusTarget = focusRecord ??
        (focusSymptomMarker ? viewerState.symptomRecord ?? undefined : undefined);

      if (!drag.active && focusTarget) {
        rotateModelTowardAnchor(modelRoot, focusTarget.anchor, mode);
      } else if (!drag.active && autoRotate) {
        modelRoot.rotation.y += isFaceMode ? 0.0013 : 0.001;
      }

      if (
        viewerState.symptomRecord &&
        viewerState.symptomRecord.ring !== viewerState.symptomRecord.mesh
      ) {
        const pulse = 1 + Math.sin(performance.now() / 260) * 0.13;
        viewerState.symptomRecord.ring.scale.setScalar(pulse);
      }

      try {
        renderer.render(scene, camera);
      } catch {
        disposed = true;
        cancelAnimationFrame(frame);
      }
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelled = true;
      rememberedRotation.set(mode, {
        x: modelRoot.rotation.x,
        y: modelRoot.rotation.y,
      });
      observer.disconnect();
      viewerCanvas.removeEventListener("pointerdown", handlePointerDown);
      viewerCanvas.removeEventListener("pointermove", handlePointerMove);
      viewerCanvas.removeEventListener("pointerup", handlePointerUp);
      if (viewerStateRef.current === viewerState) {
        viewerStateRef.current = null;
      }
      disposeObject(scene);
      renderer.dispose();
    };
  }, [autoRotate, focusSymptomMarker, isCompleteSymptomTone, mode, modelConfig]);

  useEffect(() => {
    const viewerState = viewerStateRef.current;
    if (!viewerState || viewerState.mode !== mode) {
      return;
    }

    viewerState.focusPointId = focusPointId;

    syncMarkerObjects(
      viewerState.markerGroup,
      viewerState.markerMeshes,
      viewerState.markerRecords,
      points,
      activePointId,
      viewerState.materials,
      viewerState.camera,
    );

    if (viewerState.model) {
      snapMarkersToModelSurface(
        viewerState.modelRoot,
        viewerState.markerGroup,
        viewerState.model,
        viewerState.markerRecords,
      );
    }
  }, [activePointId, focusPointId, mode, points]);

  useEffect(() => {
    const viewerState = viewerStateRef.current;
    if (!viewerState || viewerState.mode !== mode) {
      return;
    }
    syncSymptomMarker(viewerState, symptomMarker);
    if (viewerState.model) {
      snapSymptomMarker(viewerState, viewerState.model);
    }
  }, [mode, symptomMarker]);

  return (
    <div
      className={`anatomy-viewer ${regionSelectionEnabled ? "is-region-picker" : ""}`}
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        aria-label={mode === "face" ? "臉部 3D 模型" : "全身 3D 模型"}
      />
      <div className="viewer-hint" aria-hidden="true">
        {regionSelectionEnabled ? "拖曳旋轉 / 點身體選部位" : "拖曳旋轉 / 點選標記"}
      </div>
      {symptomMarker ? (
        <div className="viewer-legend" aria-label="模型標記圖例">
          <span><i className="legend-dot legend-dot-symptom" />綠色圈：部位</span>
          <span><i className="legend-dot legend-dot-acupoint" />白色點：穴位</span>
        </div>
      ) : null}
      <a
        className="model-credit"
        href={modelConfig.source}
        target="_blank"
        rel="noreferrer"
        aria-label={`${modelConfig.title} 模型來源`}
      >
        Model: {modelConfig.title} by {modelConfig.author} / {modelConfig.license}
      </a>
    </div>
  );
}

function syncMarkerObjects(
  markerGroup: THREE.Group,
  markerMeshes: THREE.Object3D[],
  markerRecords: MarkerRecord[],
  points: PointMatch[],
  activePointId: string | undefined,
  materials: ViewerState["materials"],
  camera: THREE.PerspectiveCamera,
) {
  markerGroup.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
  markerGroup.clear();
  markerMeshes.length = 0;
  markerRecords.length = 0;
  markerGroup.visible = false;

  points.forEach((point) => {
    const isActive = point.id === activePointId;
    const geometry = getAcupointGeometry(point.id);
    const markerGeometries =
      geometry?.laterality === "bilateral" && !point.side
        ? [
            mirrorGeometry(geometry, -1),
            mirrorGeometry(geometry, 1),
          ]
        : [geometry];

    markerGeometries.forEach((markerGeometry) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(isActive ? markerRadius.active : markerRadius.idle, 32, 24),
      isActive ? materials.markerActive : materials.marker,
    );
    const calibratedPosition = markerGeometry?.position ?? point.position;
    const anchor = new THREE.Vector3(
      calibratedPosition.x,
      calibratedPosition.y,
      calibratedPosition.z,
    );
    mesh.position.copy(anchor);
    mesh.userData.pointId = point.id;
    markerMeshes.push(mesh);
    markerGroup.add(mesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(
        isActive ? markerRingRadius.active : markerRingRadius.idle,
        0.0035,
        8,
        38,
      ),
      isActive ? materials.markerRingActive : materials.markerRing,
    );
    ring.position.copy(mesh.position);
    ring.lookAt(camera.position);
    ring.userData.pointId = point.id;
    markerMeshes.push(ring);
    markerGroup.add(ring);
    const calibratedDirection = markerGeometry?.surfaceDirection ?? calibratedPosition;
    const surfaceDirection = new THREE.Vector3(
      calibratedDirection.x,
      calibratedDirection.y,
      calibratedDirection.z,
    ).normalize();
    markerRecords.push({
      pointId: point.id,
      mesh,
      ring,
      anchor,
      surfaceDirection,
      projectionDistance: markerGeometry?.projectionDistance,
    });
    });
  });
}

function mirrorGeometry(geometry: AcupointGeometry, sideSign: -1 | 1): AcupointGeometry {
  return {
    ...geometry,
    position: {
      ...geometry.position,
      x: Math.abs(geometry.position.x) * sideSign,
    },
    surfaceDirection: {
      ...geometry.surfaceDirection,
      x: Math.abs(geometry.surfaceDirection.x) * sideSign,
    },
  };
}

function syncSymptomMarker(viewerState: ViewerState, marker: SymptomMarker | undefined) {
  viewerState.symptomGroup.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
    }
  });
  viewerState.symptomGroup.clear();
  viewerState.symptomRecord = null;
  viewerState.symptomPath = null;
  viewerState.symptomGroup.visible = false;

  if (!marker) {
    return;
  }

  const anchor = new THREE.Vector3(marker.position.x, marker.position.y, marker.position.z);
  const direction = marker.surfaceDirection
    ? new THREE.Vector3(
        marker.surfaceDirection.x,
        marker.surfaceDirection.y,
        marker.surfaceDirection.z,
      ).normalize()
    : anchor.clone().normalize();

  if (marker.path && marker.path.length >= 2) {
    const anchors = marker.path.map(
      (point) => new THREE.Vector3(point.x, point.y, point.z),
    );
    const curve = new THREE.CatmullRomCurve3(anchors);
    const pathMesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.012, 10, false),
      viewerState.materials.symptom,
    );
    viewerState.symptomGroup.add(pathMesh);
    viewerState.symptomPath = {
      anchors,
      direction,
      projectionDistance: marker.projectionDistance,
      mesh: pathMesh,
    };
    viewerState.symptomRecord = {
      pointId: "symptom-location",
      mesh: pathMesh,
      ring: pathMesh,
      anchor,
      surfaceDirection: direction,
      snapToSurface: false,
    };
    viewerState.symptomGroup.visible = true;
    return;
  }
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 24, 18),
    viewerState.materials.symptom,
  );
  mesh.position.copy(anchor);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.008, 10, 48),
    viewerState.materials.symptom,
  );
  ring.position.copy(anchor);
  viewerState.symptomGroup.add(mesh, ring);
  viewerState.symptomRecord = {
    pointId: "symptom-location",
    mesh,
    ring,
    anchor,
    surfaceDirection: direction,
    projectionDistance: marker.projectionDistance,
    snapToSurface: Boolean(marker.surfaceDirection),
  };
  viewerState.symptomGroup.visible = true;
}

function snapSymptomMarker(viewerState: ViewerState, model: THREE.Object3D) {
  if (viewerState.symptomPath) {
    snapSymptomPathToModel(viewerState, model);
    return;
  }
  const marker = viewerState.symptomRecord;
  if (!marker) {
    return;
  }
  if (!marker.snapToSurface) {
    viewerState.symptomGroup.visible = true;
    return;
  }
  snapMarkersToModelSurface(
    viewerState.modelRoot,
    viewerState.symptomGroup,
    model,
    [marker],
  );
}

function snapSymptomPathToModel(viewerState: ViewerState, model: THREE.Object3D) {
  const path = viewerState.symptomPath;
  if (!path) {
    return;
  }

  const modelMeshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      modelMeshes.push(child);
    }
  });
  if (!modelMeshes.length) {
    return;
  }

  viewerState.modelRoot.updateMatrixWorld(true);
  viewerState.symptomGroup.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const sphere = new THREE.Sphere();
  new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);
  const castDistance =
    path.projectionDistance ?? Math.min(Math.max(sphere.radius * 0.55, 0.7), 1.15);
  const directionWorld = path.direction
    .clone()
    .transformDirection(viewerState.modelRoot.matrixWorld)
    .normalize();
  const raycaster = new THREE.Raycaster();
  const projected = path.anchors.map((anchor) => {
    const anchorWorld = viewerState.symptomGroup.localToWorld(anchor.clone());
    const origin = anchorWorld
      .clone()
      .add(directionWorld.clone().multiplyScalar(castDistance));
    raycaster.set(origin, directionWorld.clone().negate());
    const hit = raycaster.intersectObjects(modelMeshes, false)[0];
    return hit
      ? viewerState.symptomGroup.worldToLocal(hit.point.clone()).add(
          path.direction.clone().multiplyScalar(0.012),
        )
      : anchor;
  });

  path.mesh.geometry.dispose();
  path.mesh.geometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(projected),
    32,
    0.012,
    10,
    false,
  );
  viewerState.symptomGroup.visible = true;
}

function rotateModelTowardAnchor(
  modelRoot: THREE.Group,
  anchor: THREE.Vector3,
  mode: FeatureModeId,
) {
  const targetY = nearestEquivalentAngle(modelRoot.rotation.y, Math.atan2(-anchor.x, anchor.z));
  const targetX = initialModelRotation[mode].x;

  modelRoot.rotation.y = THREE.MathUtils.lerp(modelRoot.rotation.y, targetY, 0.085);
  modelRoot.rotation.x = THREE.MathUtils.lerp(modelRoot.rotation.x, targetX, 0.07);
}

function nearestEquivalentAngle(current: number, target: number) {
  const turn = Math.PI * 2;
  return target + Math.round((current - target) / turn) * turn;
}

function prepareLoadedModel(root: THREE.Object3D, fallbackMaterial: THREE.Material) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.lerp(softMaterialColor, 0.18);
        material.roughness = Math.max(material.roughness, 0.68);
        material.metalness = 0;
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }
    });

    if (!child.material) {
      child.material = fallbackMaterial;
    }
  });
}

function fitModelToViewer(model: THREE.Object3D, config: ModelConfig) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const currentHeight = Math.max(size.y, 0.001);
  const scale = config.targetHeight / currentHeight;
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, config.centerY - center.y * scale, -center.z * scale);
  model.updateMatrixWorld(true);
}

function createFallbackModel(
  root: THREE.Group,
  skin: THREE.MeshStandardMaterial,
  mode: FeatureModeId,
): THREE.Group {
  const fallbackRoot = new THREE.Group();
  root.add(fallbackRoot);

  if (mode === "face") {
    createFallbackHead(fallbackRoot, skin);
  } else {
    createFallbackBody(fallbackRoot, skin);
  }

  return fallbackRoot;
}

function createFallbackHead(root: THREE.Group, skin: THREE.MeshStandardMaterial) {
  addEllipsoid(root, skin, [0, 0.26, 0], [0.62, 0.82, 0.55]);
  addEllipsoid(root, skin, [-0.58, 0.2, -0.02], [0.1, 0.22, 0.08]);
  addEllipsoid(root, skin, [0.58, 0.2, -0.02], [0.1, 0.22, 0.08]);
  addEllipsoid(root, skin, [0, -0.6, -0.04], [0.18, 0.34, 0.16]);
  addEllipsoid(root, skin, [0, -0.88, -0.08], [0.52, 0.16, 0.24]);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 32), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0.27, 0.62);
  root.add(nose);
}

function createFallbackBody(root: THREE.Group, skin: THREE.MeshStandardMaterial) {
  addCapsule(root, skin, [0, 0.38, 0], 0.34, 0.78, [0, 0, 0]);
  addEllipsoid(root, skin, [0, -0.22, 0], [0.42, 0.24, 0.26]);
  addCapsule(root, skin, [0, 1.0, 0], 0.1, 0.18, [0, 0, 0]);
  addEllipsoid(root, skin, [0, 1.34, 0], [0.24, 0.3, 0.22]);

  addCapsule(root, skin, [-0.48, 0.48, 0], 0.075, 0.58, [0, 0, -0.44]);
  addCapsule(root, skin, [0.48, 0.48, 0], 0.075, 0.58, [0, 0, 0.44]);
  addCapsule(root, skin, [-0.72, 0.0, 0.05], 0.07, 0.52, [0, 0, -0.18]);
  addCapsule(root, skin, [0.72, 0.0, 0.05], 0.07, 0.52, [0, 0, 0.18]);
  addEllipsoid(root, skin, [-0.78, -0.33, 0.06], [0.1, 0.08, 0.05]);
  addEllipsoid(root, skin, [0.78, -0.33, 0.06], [0.1, 0.08, 0.05]);

  addCapsule(root, skin, [-0.18, -0.68, 0], 0.09, 0.64, [0, 0, -0.06]);
  addCapsule(root, skin, [0.18, -0.68, 0], 0.09, 0.64, [0, 0, 0.06]);
  addCapsule(root, skin, [-0.2, -1.24, 0.02], 0.08, 0.6, [0, 0, 0.04]);
  addCapsule(root, skin, [0.2, -1.24, 0.02], 0.08, 0.6, [0, 0, -0.04]);
  addEllipsoid(root, skin, [-0.2, -1.62, 0.14], [0.16, 0.06, 0.22]);
  addEllipsoid(root, skin, [0.2, -1.62, 0.14], [0.16, 0.06, 0.22]);
}

function addEllipsoid(
  root: THREE.Group,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  root.add(mesh);
  return mesh;
}

function addCapsule(
  root: THREE.Group,
  material: THREE.Material,
  position: [number, number, number],
  radius: number,
  length: number,
  rotation: [number, number, number],
) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 24, 32), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  root.add(mesh);
  return mesh;
}

function snapMarkersToModelSurface(
  modelRoot: THREE.Group,
  markerGroup: THREE.Group,
  model: THREE.Object3D,
  markers: MarkerRecord[],
) {
  const modelMeshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      modelMeshes.push(child);
    }
  });

  if (!modelMeshes.length || !markers.length) {
    markerGroup.visible = true;
    return;
  }

  modelRoot.updateMatrixWorld(true);
  markerGroup.updateMatrixWorld(true);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const sphere = new THREE.Sphere();
  const centerWorld = new THREE.Vector3();
  const centerLocal = new THREE.Vector3();
  box.getBoundingSphere(sphere);
  box.getCenter(centerWorld);
  centerLocal.copy(centerWorld);
  modelRoot.worldToLocal(centerLocal);

  const raycaster = new THREE.Raycaster();
  const normalMatrix = new THREE.Matrix3();
  const zAxis = new THREE.Vector3(0, 0, 1);

  markers.forEach((marker) => {
    const anchorWorld = markerGroup.localToWorld(marker.anchor.clone());
    const outwardLocal = marker.surfaceDirection.clone().normalize();
    const outwardWorld = outwardLocal.clone().transformDirection(modelRoot.matrixWorld).normalize();
    const localCastDistance =
      marker.projectionDistance ?? Math.min(Math.max(sphere.radius * 0.55, 0.7), 1.15);
    const originWorld = anchorWorld
      .clone()
      .add(outwardWorld.clone().multiplyScalar(localCastDistance));

    raycaster.set(originWorld, outwardWorld.clone().negate());
    let hit = raycaster.intersectObjects(modelMeshes, false)[0];
    if (!hit) {
      const radialLocal = marker.anchor.clone().sub(centerLocal);
      if (radialLocal.lengthSq() < 0.0001) {
        radialLocal.set(0, 0, 1);
      }
      radialLocal.normalize();
      const radialWorld = radialLocal.transformDirection(modelRoot.matrixWorld).normalize();
      const radialOrigin = centerWorld
        .clone()
        .add(radialWorld.clone().multiplyScalar(sphere.radius * 2.2 + 0.35));
      raycaster.set(radialOrigin, radialWorld.clone().negate());
      hit = raycaster.intersectObjects(modelMeshes, false)[0];
    }
    if (!hit) {
      return;
    }

    const surfaceLocal = markerGroup.worldToLocal(hit.point.clone());
    marker.mesh.position.copy(surfaceLocal);
    marker.ring.position.copy(surfaceLocal);

    const normalWorld = hit.face
      ? hit.face.normal.clone().applyMatrix3(normalMatrix.getNormalMatrix(hit.object.matrixWorld))
      : outwardWorld.clone();
    normalWorld.normalize();
    if (normalWorld.dot(outwardWorld) < 0) {
      normalWorld.negate();
    }

    const normalLocalEnd = markerGroup.worldToLocal(hit.point.clone().add(normalWorld));
    const normalLocal = normalLocalEnd.sub(surfaceLocal).normalize();
    marker.ring.quaternion.setFromUnitVectors(zAxis, normalLocal);
  });
  markerGroup.visible = true;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}
