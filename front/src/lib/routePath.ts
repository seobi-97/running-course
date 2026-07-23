import type { LatLngPoint } from '@/types/course';

/** 좌표 비교용 키 (소수점 6자리) */
export function pointKeyForCompare(point: LatLngPoint): string {
  return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
}

/** lat/lng 를 Number 로 강제하고 유한값만 남긴 새 좌표를 반환한다. */
export function normalizePoint(point: LatLngPoint): LatLngPoint {
  return { lat: Number(point.lat), lng: Number(point.lng) };
}

/**
 * API/추천 응답의 구간 좌표 배열을 정규화한다. 원본은 변경하지 않는다.
 * 2점 미만이거나 비유한 좌표를 가진 구간은 제거한다.
 */
export function normalizeRoutePathSegments(raw: unknown): LatLngPoint[][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((segment) => {
      if (!Array.isArray(segment)) return [];
      return segment
        .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
    })
    .filter((segment) => segment.length >= 2);
}

/** 연속 지점 사이를 직선 구간으로 나눈다. (경로 세그먼트 폴백용) */
export function straightSegmentPathFromPoints(waypoints: readonly LatLngPoint[]): LatLngPoint[][] {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return [];
  const segments: LatLngPoint[][] = [];
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    segments.push([normalizePoint(waypoints[index]), normalizePoint(waypoints[index + 1])]);
  }
  return segments;
}
