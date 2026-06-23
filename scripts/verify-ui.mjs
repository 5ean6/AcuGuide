import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const artifactsDir = new URL("../artifacts/", import.meta.url);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function canvasStats(page) {
  await page.waitForTimeout(1800);
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas"));
    const canvas = canvases.find((item) => {
      const gl = item.getContext("webgl2") || item.getContext("webgl");
      return Boolean(gl);
    });

    if (!canvas) {
      return { ok: false, reason: "missing webgl canvas" };
    }

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
      return { ok: false, reason: "missing webgl context" };
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const x = 0;
    const y = 0;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let visible = 0;
    let alpha = 0;
    const pixelCount = pixels.length / 4;
    const stride = Math.max(1, Math.floor(pixelCount / 12000));
    for (let pixel = 0; pixel < pixelCount; pixel += stride) {
      const index = pixel * 4;
      const rgb = pixels[index] + pixels[index + 1] + pixels[index + 2];
      if (pixels[index + 3] > 0) {
        alpha += 1;
      }
      if (pixels[index + 3] > 0 && rgb > 24) {
        visible += 1;
      }
    }
    const sampledPixels = Math.ceil(pixelCount / stride);

    return {
      ok: visible > sampledPixels / 80,
      visible,
      alpha,
      samplePixels: sampledPixels,
      drawingBufferWidth: gl.drawingBufferWidth,
      drawingBufferHeight: gl.drawingBufferHeight,
    };
  });
}

async function runViewport(browser, baseUrl, viewport) {
  const context = await browser.newContext({
    viewport,
    permissions: ["camera"],
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");

  await page.getByText("human head by sculptgl").waitFor();
  const faceStats = await canvasStats(page);
  assert(faceStats.ok, `${viewport.name}: face canvas is blank`);
  await page.locator('[data-testid="body-tracking-panel"]').waitFor({
    state: "detached",
  });

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-face.png`, artifactsDir)),
    fullPage: true,
  });

  await page.locator("#intent-input").fill("黑眼圈");
  await page.locator('[data-testid="intent-submit"]').click();
  await page.locator('[data-testid="model-confirm"]').waitFor();
  await page.locator('[data-testid="model-confirm"]').click();
  await page.locator('[data-testid="face-tracking-panel"]').waitFor();
  await page.locator('[data-testid="face-camera-toggle"]').click();
  await page.locator('[data-testid="face-camera-state"]').filter({ hasText: "定位中" }).waitFor({
    timeout: 45000,
  });
  const faceTrackingPanel = page.locator('[data-testid="face-tracking-panel"]');
  const initialFaceTarget = await faceTrackingPanel.getAttribute("data-target-point-id");
  const initialArPointName = await page.locator('[data-testid="active-ar-point-name"]').textContent();
  await page.locator('[data-testid="next-guide-point"]').click();
  await page.waitForFunction(
    (previousTarget) =>
      document
        .querySelector('[data-testid="face-tracking-panel"]')
        ?.getAttribute("data-target-point-id") !== previousTarget,
    initialFaceTarget,
  );
  const nextArPointName = await page.locator('[data-testid="active-ar-point-name"]').textContent();
  assert(
    nextArPointName && nextArPointName !== initialArPointName,
    `${viewport.name}: next AR point did not update active point`,
  );
  await page.locator('[data-testid="face-camera-toggle"]').click();
  await page.locator('[data-testid="pressure-sound-toggle"]').click();
  const countdown = page.locator('[data-testid="pressure-countdown"]');
  const countdownBefore = Number(await countdown.textContent());
  const pressureHold = page.locator('[data-testid="pressure-hold"]');
  await pressureHold.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "mouse",
    buttons: 1,
  });
  await page.waitForTimeout(1150);
  await pressureHold.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "mouse",
    buttons: 0,
  });
  const countdownAfter = Number(await countdown.textContent());
  assert(
    countdownAfter < countdownBefore,
    `${viewport.name}: pressure countdown did not advance while pressing`,
  );
  const faceGuideStats = await canvasStats(page);
  assert(faceGuideStats.ok, `${viewport.name}: face guide canvas is blank`);

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-face-guide.png`, artifactsDir)),
    fullPage: true,
  });

  await page.locator('[data-testid="complete-guide"]').click();
  await page.getByText("完成與回饋").waitFor();
  await page.locator('[data-testid="feedback-rating-4"]').click();
  await page.locator('[data-testid="save-feedback"]').click();
  await page.locator('[data-testid="feedback-saved"]').waitFor();
  await page.locator('[data-testid="restart-guide"]').click();
  await page.getByText("調理身體").waitFor();

  await page.locator("#intent-input").fill("急性胸痛 呼吸困難");
  await page.locator('[data-testid="intent-submit"]').click();
  await page.locator('[data-testid="safety-block"]').waitFor();
  assert(
    (await page.locator('[data-testid="model-confirm"]').count()) === 0,
    `${viewport.name}: high-risk safety block still shows normal confirm`,
  );

  await page.locator('[data-testid="feature-other"]').click();
  await page.locator('[data-testid="model-confirm"]').waitFor();
  assert(
    await page.locator('[data-testid="model-confirm"]').isDisabled(),
    `${viewport.name}: other mode confirm is enabled before model body pick`,
  );
  const otherCanvas = page.locator(".anatomy-viewer canvas").first();
  const canvasBox = await otherCanvas.boundingBox();
  assert(canvasBox, `${viewport.name}: other mode canvas is not measurable`);
  await otherCanvas.click({
    position: {
      x: canvasBox.width * 0.5,
      y: canvasBox.height * 0.44,
    },
  });
  await page.waitForFunction(() => {
    const region = document.querySelector('[data-testid="selected-body-region"]');
    return region?.getAttribute("data-region-id");
  });
  const selectedRegionId = await page
    .locator('[data-testid="selected-body-region"]')
    .getAttribute("data-region-id");
  assert(selectedRegionId, `${viewport.name}: direct model body pick did not select a region`);
  const safetyBlockedAfterBodyPick =
    (await page.locator('[data-testid="safety-block"]').count()) > 0;
  if (!safetyBlockedAfterBodyPick) {
    assert(
      !(await page.locator('[data-testid="model-confirm"]').isDisabled()),
      `${viewport.name}: other mode confirm stayed disabled after direct model pick`,
    );
  }
  const otherStats = await canvasStats(page);
  assert(otherStats.ok, `${viewport.name}: other body-pick canvas is blank`);

  await page.locator('[data-testid="goal-wellness-bloating"]').click();
  await page.getByText("Human by aaron.kalvin").waitFor();
  const wellnessStats = await canvasStats(page);
  assert(wellnessStats.ok, `${viewport.name}: wellness canvas is blank`);

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-wellness-select.png`, artifactsDir)),
    fullPage: true,
  });

  await page.locator("#intent-input").fill("飯後脹氣 腹部悶");
  await page.locator('[data-testid="intent-submit"]').click();
  await page.locator('[data-testid="model-confirm"]').waitFor();
  await page.locator('[data-testid="model-confirm"]').click();
  await page.locator('[data-testid="body-tracking-panel"]').waitFor();
  await page.locator('[data-testid="recalibrate-guide"]').click();
  await page.locator('[data-testid="hand-calibration-panel"]').waitFor();
  await page.locator('[data-testid="calibration-done"]').click();
  await page.locator('[data-testid="complete-guide"]').click();
  await page.getByText("完成與回饋").waitFor();
  await page.locator('[data-testid="feedback-rating-5"]').click();
  await page.locator('[data-testid="save-feedback"]').click();
  await page.locator('[data-testid="feedback-saved"]').waitFor();
  await page.locator('[data-testid="restart-guide"]').click();

  await page.locator('[data-testid="feature-body"]').click();
  await page.locator("#intent-input").fill("肩頸痠痛");

  await page.getByText("Human by aaron.kalvin").waitFor();
  const initialStats = await canvasStats(page);
  assert(initialStats.ok, `${viewport.name}: body canvas is blank`);

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-select.png`, artifactsDir)),
    fullPage: true,
  });

  await page.locator('[data-testid="intent-submit"]').click();
  await page.locator('[data-testid="model-confirm"]').waitFor();
  await page.locator('[data-testid="model-confirm"]').click();
  await page.locator('[data-testid="body-tracking-panel"]').waitFor();
  await page.locator('[data-testid="camera-toggle"]').click();
  await page.locator('[data-testid="camera-state"]').filter({ hasText: "定位中" }).waitFor({
    timeout: 45000,
  });
  await page.locator('[data-testid="camera-toggle"]').click();

  const guideStats = await canvasStats(page);
  assert(guideStats.ok, `${viewport.name}: guide canvas is blank`);
  await page.locator('[data-testid="complete-guide"]').click();
  await page.getByText("完成與回饋").waitFor();

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-guide.png`, artifactsDir)),
    fullPage: true,
  });

  await context.close();
  return {
    viewport: viewport.name,
    faceStats,
    faceGuideStats,
    otherStats,
    wellnessStats,
    initialStats,
    guideStats,
  };
}

async function runCameraDeniedFallback(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
      },
    });
  });
  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");
  await page.locator('[data-testid="model-confirm"]').click();
  await page.locator('[data-testid="face-tracking-panel"]').waitFor();
  await page.locator('[data-testid="face-camera-toggle"]').click();
  await page.getByText("已切換為 3D 與文字備援").waitFor();
  await page.locator('[data-testid="complete-guide"]').click();
  await page.getByText("完成與回饋").waitFor();
  await context.close();

  return { ok: true };
}

await rm(artifactsDir, { recursive: true, force: true });
await mkdir(artifactsDir, { recursive: true });

const server = await createServer({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  server: { host: "127.0.0.1", port: 5173 },
  logLevel: "silent",
});

await server.listen();
const baseUrl = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
try {
  const results = [];
  for (const viewport of viewports) {
    results.push(await runViewport(browser, baseUrl, viewport));
  }
  const cameraDeniedFallback = await runCameraDeniedFallback(browser, baseUrl);
  console.log(JSON.stringify({ baseUrl, results, cameraDeniedFallback }, null, 2));
  await rm(artifactsDir, { recursive: true, force: true });
} finally {
  await browser.close();
  await server.close();
}
