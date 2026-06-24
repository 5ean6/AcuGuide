import type { AcupointGeometry } from "../types";

const cloudTcm = (id: number) => `https://cloudtcm.com/acupoint/${id}`;

export const acupointGeometry: Record<string, AcupointGeometry> = {
  yintang: point([0, 0.66, 0.9], [0, 0, 1], "front", "midline", "眉間"),
  jingming: point([0.11, 0.52, 0.94], [0, 0, 1], "front", "bilateral", "內眼角", 307),
  zanzhu: point([0.17, 0.66, 0.89], [0.08, 0.05, 1], "front", "bilateral", "眉頭", 308),
  sizhukong: point([0.43, 0.59, 0.69], [0.55, 0, 0.84], "side", "bilateral", "眉梢", 226),
  tongziliao: point([0.42, 0.48, 0.74], [0.45, 0, 0.89], "side", "bilateral", "外眼角", 46),
  sibai: point([0.21, 0.39, 0.91], [0.08, -0.03, 1], "front", "bilateral", "眶下", 267),
  taiyang: point([0.52, 0.51, 0.46], [0.82, 0, 0.57], "side", "bilateral", "顳部"),
  quanliao: point([0.42, 0.24, 0.73], [0.42, -0.05, 0.9], "front", "bilateral", "顴骨下緣", 244),
  yingxiang: point([0.23, 0.18, 0.92], [0.12, 0, 1], "front", "bilateral", "鼻翼旁", 146),
  xiaguan: point([0.49, 0.05, 0.58], [0.7, 0, 0.72], "side", "bilateral", "顴弓下", 956),
  jiache: point([0.46, -0.11, 0.55], [0.64, -0.05, 0.77], "side", "bilateral", "下頜角", 271),
  touwei: point([0.43, 0.87, 0.45], [0.58, 0.28, 0.76], "side", "bilateral", "額角髮際", 272),
  baihui: point([0, 1.05, 0.01], [0, 1, 0], "top", "midline", "頭頂", 20),

  fengchi: point([0.16, 0.99, 0.15], [0.36, 0.82, 0.45], "back", "bilateral", "枕骨下", 65),
  jianjing: point([0.38, 0.86, 0.06], [0.18, 1, 0.12], "top", "bilateral", "肩上", 66),
  quchi: point([-0.62, 0.2, -0.02], [-1, 0, -0.08], "side", "bilateral", "肘外側", 136),
  hegu: point([-0.74, -0.23, -0.08], [-0.99, -0.12, 0.06], "top", "bilateral", "手背", 129),
  shenshu: point([0.17, -0.08, 0.24], [0.05, 0, 1], "back", "bilateral", "腰背", 329),
  weizhong: point([0.19, -0.79, 0.14], [0, 0, 1], "back", "bilateral", "膝窩", 344),
  xuehai: point([-0.18, -0.68, -0.13], [0.1, 0.05, -1], "front", "bilateral", "大腿內前側", 254),
  zusanli: point([0.2, -1.01, -0.14], [0.08, 0, -1], "front", "bilateral", "小腿外前側", 298),
  chengshan: point([0.2, -1.28, 0.13], [0, 0, 1], "back", "bilateral", "小腿後側", 361),

  zhongwan: point([0, 0.18, -0.22], [0, 0, -1], "front", "midline", "上腹正中", 192),
  tianshu: point([0.19, -0.03, -0.22], [0.05, 0, -1], "front", "bilateral", "臍旁", 958),
  qihai: point([0, -0.22, -0.22], [0, 0, -1], "front", "midline", "下腹正中", 186),
  guanyuan: point([0, -0.26, -0.19], [0, -0.6, -0.8], "front", "midline", "下腹正中", 184),
  neiguan: point([-0.67, -0.02, -0.1], [0.05, 0, -1], "front", "bilateral", "前臂掌側", 177),
  sanyinjiao: point([-0.18, -1.25, 0.03], [1, 0, 0.15], "side", "bilateral", "小腿內側", 250, 0.22),
  taichong: point([-0.19, -1.61, -0.18], [0, 1, -0.1], "top", "bilateral", "足背", 149),
};

export function getAcupointGeometry(id: string): AcupointGeometry | undefined {
  return acupointGeometry[id];
}

function point(
  position: [number, number, number],
  surfaceDirection: [number, number, number],
  surface: AcupointGeometry["surface"],
  laterality: AcupointGeometry["laterality"],
  region: string,
  cloudTcmId?: number,
  projectionDistance?: number,
): AcupointGeometry {
  return {
    position: vector(position),
    surfaceDirection: vector(surfaceDirection),
    surface,
    laterality,
    region,
    referenceUrl: cloudTcmId ? cloudTcm(cloudTcmId) : undefined,
    projectionDistance,
  };
}

function vector([x, y, z]: [number, number, number]) {
  return { x, y, z };
}
