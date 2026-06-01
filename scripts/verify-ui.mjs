import { mkdir } from "node:fs/promises";
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
  await page.locator('[data-testid="face-camera-toggle"]').click();
  const faceGuideStats = await canvasStats(page);
  assert(faceGuideStats.ok, `${viewport.name}: face guide canvas is blank`);

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-face-guide.png`, artifactsDir)),
    fullPage: true,
  });

  await page.locator('[data-testid="restart-guide"]').click();
  await page.getByText("調理身體").waitFor();
  await page.locator('[data-testid="goal-body-shoulder-neck"]').hover();
  const bodyHoverStats = await canvasStats(page);
  assert(bodyHoverStats.ok, `${viewport.name}: body hover preview canvas is blank`);
  await page.locator('[data-testid="goal-wellness-bloating"]').click();
  await page.getByText("Human by aaron.kalvin").waitFor();
  const wellnessStats = await canvasStats(page);
  assert(wellnessStats.ok, `${viewport.name}: wellness canvas is blank`);

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-wellness-select.png`, artifactsDir)),
    fullPage: true,
  });

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

  await page.screenshot({
    path: fileURLToPath(new URL(`${viewport.name}-guide.png`, artifactsDir)),
    fullPage: true,
  });

  await context.close();
  return {
    viewport: viewport.name,
    faceStats,
    faceGuideStats,
    bodyHoverStats,
    wellnessStats,
    initialStats,
    guideStats,
  };
}

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
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
