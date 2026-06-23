export type PressMotion = "press" | "circle" | "outward" | "down" | "up";

export function parsePressSeconds(duration: string) {
  const match = duration.match(/(\d+)/);
  return Math.max(5, Number(match?.[1] ?? 30));
}

export function getPressMotion(action: string): PressMotion {
  if (/順時針|畫圓|繞圈|環形/.test(action)) {
    return "circle";
  }

  if (/向外|往外|外推/.test(action)) {
    return "outward";
  }

  if (/向下|往下|下推/.test(action)) {
    return "down";
  }

  if (/向上|往上|上推/.test(action)) {
    return "up";
  }

  return "press";
}

export function pressMotionLabel(motion: PressMotion) {
  if (motion === "circle") {
    return "順時針畫圓";
  }
  if (motion === "outward") {
    return "由穴位向外推揉";
  }
  if (motion === "down") {
    return "向下輕推";
  }
  if (motion === "up") {
    return "向上輕推";
  }
  return "垂直定點按壓";
}
