const test = require("node:test");
const assert = require("node:assert/strict");

const { nextDemoStage } = require("../.tmp-tests/src/lib/demoFlow.js");
const {
  FEEDBACK_STORAGE_KEY,
  createFeedbackRecord,
  loadFeedbackRecords,
  saveFeedbackRecord,
} = require("../.tmp-tests/src/lib/feedback.js");
const { recommendAcupoints } = require("../.tmp-tests/src/lib/recommender.js");
const {
  applySafetyToRecommendation,
  evaluateSafety,
} = require("../.tmp-tests/src/lib/safety.js");
const { createBodyRegionPick } = require("../.tmp-tests/src/lib/bodyRegions.js");
const { getFaceAlignment } = require("../.tmp-tests/src/lib/faceAlignment.js");
const {
  bodyTrackedPointIds,
  faceAcupointLayouts,
  getBodyAcupointLandmark,
} = require("../.tmp-tests/src/lib/acupointTracking.js");
const { guidePoints } = require("../.tmp-tests/src/data/acupoints.js");
const {
  acupointGeometry,
  getAcupointGeometry,
} = require("../.tmp-tests/src/data/acupointGeometry.js");
const { getSymptomMarker } = require("../.tmp-tests/src/data/symptomLocations.js");
const {
  getPressMotion,
  parsePressSeconds,
  pressMotionLabel,
} = require("../.tmp-tests/src/lib/pressGuidance.js");

test("high-risk symptoms are blocked before normal recommendation", () => {
  const recommendation = recommendAcupoints({
    mode: "body",
    query: "肩頸痠痛",
  });
  const assessment = evaluateSafety("突然胸痛 呼吸困難", recommendation.points);
  const safeResult = applySafetyToRecommendation(recommendation, assessment);

  assert.equal(assessment.severity, "block");
  assert.equal(safeResult.points.length, 0);
  assert.equal(safeResult.recommendation.engine.status, "safety_blocked");
  assert.match(safeResult.recommendation.summary, /不提供一般穴位推薦/);
});

test("symptom matching returns expected shoulder and neck points", () => {
  const result = recommendAcupoints({
    mode: "body",
    query: "肩頸痠痛",
    fallbackGoalId: "body-shoulder-neck",
  });
  const ids = result.points.map((point) => point.id);

  assert.ok(ids.includes("jianjing"));
  assert.ok(ids.includes("fengchi"));
  assert.ok(result.recommendation.confidence >= 0.48);
});

test("lower-back preset prioritizes lower-back point before remote supporting points", () => {
  const result = recommendAcupoints({
    mode: "body",
    query: "腰背 下背 腰部 緊繃 腎俞 腎俞 腰部保養",
    fallbackGoalId: "body-lower-back",
  });

  assert.equal(result.points[0].id, "shenshu");
});

test("other mode can recommend from a directly picked body region", () => {
  const result = recommendAcupoints({
    mode: "other",
    query: "手腕痛 手肘緊繃 曲池 合谷 內關",
    fallbackGoalId: "other-model-pick",
  });
  const ids = result.points.map((point) => point.id);

  assert.ok(ids.includes("quchi"));
  assert.ok(ids.includes("hegu"));
  assert.ok(ids.includes("neiguan"));
});

test("body model coordinates classify torso clicks as stomach region", () => {
  const pick = createBodyRegionPick({ x: 0.02, y: 0.02, z: -0.18 });

  assert.equal(pick.id, "stomach");
  assert.match(pick.query, /中脘/);
});

test("face alignment detects turn and head tilt before AR guidance", () => {
  const createFace = (noseX, rightEyeY = 0.4) => {
    const landmarks = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5 }));
    landmarks[33] = { x: 0.35, y: 0.4 };
    landmarks[263] = { x: 0.65, y: rightEyeY };
    landmarks[1] = { x: noseX, y: 0.56 };
    return landmarks;
  };

  assert.equal(getFaceAlignment(createFace(0.5)).state, "aligned");
  assert.equal(getFaceAlignment(createFace(0.58)).state, "turn");
  assert.equal(getFaceAlignment(createFace(0.5, 0.45)).state, "level");
});

test("all face and body acupoints have MediaPipe tracking definitions", () => {
  assert.equal(Object.keys(faceAcupointLayouts).length, 13);
  assert.equal(bodyTrackedPointIds.length, 16);
  const trackedPointIds = new Set([
    ...Object.keys(faceAcupointLayouts),
    ...bodyTrackedPointIds,
  ]);
  assert.deepEqual(
    guidePoints.map((point) => point.id).sort(),
    [...trackedPointIds].sort(),
  );

  const pose = Array.from({ length: 33 }, (_, index) => ({
    x: 0.25 + (index % 2) * 0.5,
    y: 0.08 + index * 0.025,
    z: 0,
    visibility: 1,
  }));
  const hand = Array.from({ length: 21 }, (_, index) => ({
    x: 0.35 + index * 0.008,
    y: 0.5 + index * 0.006,
    z: 0,
    visibility: 1,
  }));

  bodyTrackedPointIds.forEach((pointId) => {
    const target = getBodyAcupointLandmark(pointId, {
      pose,
      leftHand: hand,
      rightHand: hand,
    });
    assert.ok(target, `${pointId} is missing a tracking target`);
    assert.ok(Number.isFinite(target.x) && Number.isFinite(target.y));
  });
});

test("every displayed acupoint has calibrated geometry and a projection direction", () => {
  assert.equal(Object.keys(acupointGeometry).length, guidePoints.length);

  guidePoints.forEach((point) => {
    const geometry = getAcupointGeometry(point.id);
    assert.ok(geometry, `${point.id} is missing calibrated geometry`);
    const directionLength = Math.hypot(
      geometry.surfaceDirection.x,
      geometry.surfaceDirection.y,
      geometry.surfaceDirection.z,
    );
    assert.ok(directionLength > 0.5, `${point.id} has an invalid projection direction`);
  });
});

test("front and back body points project toward opposite model surfaces", () => {
  const abdomen = getAcupointGeometry("zhongwan");
  const lowerBack = getAcupointGeometry("shenshu");
  const calfBack = getAcupointGeometry("chengshan");

  assert.ok(abdomen.surfaceDirection.z < 0);
  assert.ok(lowerBack.surfaceDirection.z > 0);
  assert.ok(calfBack.surfaceDirection.z > 0);
});

test("preset goals expose a separate symptom marker from acupoint markers", () => {
  const eyeSymptom = getSymptomMarker("face-eyelid-puffiness");
  const backSymptom = getSymptomMarker("body-lower-back");
  const nasolabialSymptom = getSymptomMarker("face-nasolabial");

  assert.equal(eyeSymptom.label, "眼周疲勞位置");
  assert.ok(eyeSymptom.surfaceDirection.z > 0);
  assert.equal(backSymptom.label, "腰背緊繃位置");
  assert.ok(backSymptom.surfaceDirection.z > 0);
  assert.equal(nasolabialSymptom.path.length, 3);
});

test("pressure guidance parses duration and massage direction", () => {
  assert.equal(parsePressSeconds("15 秒 x 2"), 15);
  assert.equal(getPressMotion("由穴位向外輕推"), "outward");
  assert.equal(getPressMotion("順時針畫圓按揉"), "circle");
  assert.equal(pressMotionLabel("down"), "向下輕推");
});


test("pregnancy caution removes contraindicated candidate points", () => {
  const result = recommendAcupoints({
    mode: "body",
    query: "我懷孕，肩頸痠痛",
    fallbackGoalId: "body-shoulder-neck",
  });
  const assessment = evaluateSafety("我懷孕，肩頸痠痛", result.points);
  const safeResult = applySafetyToRecommendation(result, assessment);

  assert.equal(assessment.severity, "caution");
  assert.ok(assessment.removedPointNames.includes("肩井"));
  assert.ok(safeResult.points.every((point) => !point.caution.includes("孕")));
});

test("demo flow stage transitions cover recommendation, calibration, completion, and restart", () => {
  assert.equal(nextDemoStage("select", "confirmRecommendation"), "guide");
  assert.equal(nextDemoStage("guide", "requestCalibration"), "calibrate");
  assert.equal(nextDemoStage("calibrate", "finishCalibration"), "guide");
  assert.equal(nextDemoStage("guide", "completeGuide"), "complete");
  assert.equal(nextDemoStage("complete", "restart"), "select");
});

test("feedback records are stored in localStorage-compatible storage", () => {
  const storage = createMemoryStorage();
  const wellness = recommendAcupoints({
    mode: "wellness",
    query: "脹氣腹脹",
    fallbackGoalId: "wellness-bloating",
  });
  const record = createFeedbackRecord({
    mode: "wellness",
    query: "脹氣腹脹",
    points: wellness.points,
    rating: 6,
    note: "  定位清楚  ",
    now: new Date("2026-06-19T00:00:00.000Z"),
  });

  assert.equal(record.rating, 5);
  assert.equal(record.note, "定位清楚");
  assert.equal(saveFeedbackRecord(record, storage), true);
  assert.equal(storage.getItem(FEEDBACK_STORAGE_KEY).includes("zhongwan"), true);
  assert.deepEqual(loadFeedbackRecords(storage), [record]);
});

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
