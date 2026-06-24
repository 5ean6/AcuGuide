import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
import ts from "typescript";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, init = {}) {
    super(type);
    this.lengthComputable = init.lengthComputable ?? false;
    this.loaded = init.loaded ?? 0;
    this.total = init.total ?? 0;
  }
};

const faceIds = new Set([
  "yintang",
  "jingming",
  "zanzhu",
  "sizhukong",
  "tongziliao",
  "sibai",
  "taiyang",
  "quanliao",
  "yingxiang",
  "xiaguan",
  "jiache",
  "touwei",
  "baihui",
]);

const geometryModule = await importTypeScriptModule("src/data/acupointGeometry.ts");
const symptomModule = await importTypeScriptModule("src/data/symptomLocations.ts");

const models = {
  face: await loadModel("public/models/head/scene.gltf", 1.92, 0.2),
  body: await loadModel("public/models/human/scene.gltf", 3.22, -0.12),
};

let failures = 0;
for (const [id, geometry] of Object.entries(geometryModule.acupointGeometry)) {
  const model = faceIds.has(id) ? models.face : models.body;
  const result = projectToSurface(model, geometry);
  if (!result) {
    failures += 1;
    const nearest = nearestVertex(model, toVector(geometry.position));
    console.error(
      `${id.padEnd(12)} MISS  nearest=(${format(nearest.point)}) normal=(${format(nearest.normal)}) distance=${nearest.distance.toFixed(3)}`,
    );
    continue;
  }

  const offset = result.distanceTo(toVector(geometry.position));
  const status = offset <= 0.32 ? "OK" : "CHECK";
  failures += status === "CHECK" ? 1 : 0;
  console.log(
    `${id.padEnd(12)} ${status.padEnd(5)} offset=${offset.toFixed(3)} hit=(${format(result)})`,
  );
}

for (const [id, marker] of Object.entries(symptomModule.symptomLocations)) {
  const model = id.startsWith("face-") ? models.face : models.body;
  const result = projectToSurface(model, marker);
  if (!result) {
    failures += 1;
    console.error(`symptom:${id.padEnd(24)} MISS`);
    continue;
  }
  const offset = result.distanceTo(toVector(marker.position));
  const status = offset <= 0.32 ? "OK" : "CHECK";
  failures += status === "CHECK" ? 1 : 0;
  console.log(`symptom:${id.padEnd(24)} ${status.padEnd(5)} offset=${offset.toFixed(3)}`);
}

if (failures) {
  console.error(`\n${failures} acupoint projection(s) require calibration.`);
  process.exitCode = 1;
} else {
  console.log(
    `\nAll ${Object.keys(geometryModule.acupointGeometry).length} acupoints and ${Object.keys(symptomModule.symptomLocations).length} symptom markers hit the intended model surface.`,
  );
}

async function importTypeScriptModule(path) {
  const source = await readFile(path, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);
}

async function loadModel(gltfPath, targetHeight, centerY) {
  const gltfJson = JSON.parse(await readFile(gltfPath, "utf8"));
  const directory = gltfPath.slice(0, gltfPath.lastIndexOf("/") + 1);
  const binaryPath = `${directory}${gltfJson.buffers[0].uri}`;
  const binary = await readFile(binaryPath);
  gltfJson.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString("base64")}`;

  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(JSON.stringify(gltfJson), pathToFileURL(directory).href);
  fitModel(gltf.scene, targetHeight, centerY);
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

function fitModel(model, targetHeight, centerY) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, centerY - center.y * scale, -center.z * scale);
}

function projectToSurface(model, geometry) {
  const anchor = toVector(geometry.position);
  const direction = toVector(geometry.surfaceDirection).normalize();
  const box = new THREE.Box3().setFromObject(model);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const castDistance =
    geometry.projectionDistance ?? Math.min(Math.max(sphere.radius * 0.55, 0.7), 1.15);
  const origin = anchor.clone().add(direction.clone().multiplyScalar(castDistance));
  const raycaster = new THREE.Raycaster(origin, direction.clone().negate());
  return raycaster.intersectObject(model, true)[0]?.point;
}

function toVector(value) {
  return new THREE.Vector3(value.x, value.y, value.z);
}

function nearestVertex(model, anchor) {
  const point = new THREE.Vector3();
  const nearest = new THREE.Vector3();
  const nearestNormal = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let distance = Number.POSITIVE_INFINITY;

  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const positions = child.geometry.getAttribute("position");
    const normals = child.geometry.getAttribute("normal");
    normalMatrix.getNormalMatrix(child.matrixWorld);
    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld);
      const candidateDistance = point.distanceToSquared(anchor);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        nearest.copy(point);
        if (normals) {
          normal.fromBufferAttribute(normals, index).applyMatrix3(normalMatrix).normalize();
          nearestNormal.copy(normal);
        }
      }
    }
  });

  return { point: nearest, normal: nearestNormal, distance: Math.sqrt(distance) };
}

function format(vector) {
  return [vector.x, vector.y, vector.z].map((value) => value.toFixed(3)).join(", ");
}
