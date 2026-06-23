import type { BodyRegionId, BodyRegionPick, PointPosition } from "../types";

type BodyRegionDefinition = {
  id: BodyRegionId;
  label: string;
  query: string;
};

const bodyRegions: Record<BodyRegionId, BodyRegionDefinition> = {
  "head-neck": {
    id: "head-neck",
    label: "頭頸",
    query: "頭痛 後頸緊 脖子痠 眼睛疲勞 風池 太陽 百會 合谷",
  },
  chest: {
    id: "chest",
    label: "胸口",
    query: "胸痛 胸悶 呼吸困難 冒冷汗 心悸",
  },
  stomach: {
    id: "stomach",
    label: "胃腹",
    query: "胃痛 腹脹 消化不順 腹部悶 中脘 天樞 內關",
  },
  "lower-back": {
    id: "lower-back",
    label: "腰背",
    query: "腰背疼痛 腰背緊繃 下背痠 腎俞 委中 合谷",
  },
  "upper-limb": {
    id: "upper-limb",
    label: "手臂 / 手腕",
    query: "手痛 手腕痛 手肘緊繃 虎口痠 曲池 合谷 內關",
  },
  "lower-limb": {
    id: "lower-limb",
    label: "腿部 / 腳踝",
    query: "腳痛 腿痠 膝蓋不適 腳踝疼痛 足三里 承山 三陰交 太衝",
  },
};

export function createBodyRegionPick(position: PointPosition): BodyRegionPick {
  const region = bodyRegions[classifyBodyRegion(position)];

  return {
    id: region.id,
    label: region.label,
    query: region.query,
    position,
  };
}

function classifyBodyRegion(position: PointPosition): BodyRegionId {
  const absX = Math.abs(position.x);

  if (position.y > 0.82) {
    return "head-neck";
  }

  if (absX > 0.36 && position.y > -0.34) {
    return "upper-limb";
  }

  if (position.y < -0.52) {
    return "lower-limb";
  }

  if (position.z > 0.08 && position.y < 0.5) {
    return "lower-back";
  }

  if (position.y > 0.28) {
    return "chest";
  }

  return "stomach";
}
