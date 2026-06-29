import { getAcupointGeometry } from "../data/acupointGeometry";
import type { PointMatch, PointSide, SidePreference } from "../types";

export function expandLateralityPoints(
  points: PointMatch[],
  preference: SidePreference,
): PointMatch[] {
  return points.flatMap((point): PointMatch[] => {
    const geometry = getAcupointGeometry(point.id);
    if (geometry?.laterality !== "bilateral") {
      return [{ ...point, baseId: point.baseId ?? point.id, side: "midline" as PointSide }];
    }

    if (preference === "both") {
      return [{ ...point, baseId: point.baseId ?? point.id, side: undefined }];
    }

    return [
      {
        ...point,
        id: sidePointId(point.id, preference),
        baseId: point.id,
        side: preference,
      },
    ];
  });
}

export function sidePointId(id: string, side: PointSide) {
  return side === "midline" ? basePointId(id) : `${basePointId(id)}:${side}`;
}

export function basePointId(id: string) {
  return id.split(":")[0] ?? id;
}
