/** 위경도 좌표 한 점 */
export interface LatLngPoint {
  lat: number;
  lng: number;
}

/**
 * 경로 계산 출처.
 * - TMAP_PEDESTRIAN: 전 구간 TMAP 보행 경로
 * - PARTIAL_FALLBACK: 일부 구간만 직선 추정
 * - HAVERSINE_FALLBACK: 전 구간 직선 추정 (추천에서는 제외됨)
 */
export type RouteSource = 'TMAP_PEDESTRIAN' | 'PARTIAL_FALLBACK' | 'HAVERSINE_FALLBACK';

/** POST /api/course/metrics 응답 */
export interface CourseMetrics {
  totalDistanceMeters: number;
  totalDistanceKm?: number;
  segmentDistancesMeters: number[];
  routePath: LatLngPoint[];
  routePathSegments: LatLngPoint[][];
  routeSource: RouteSource;
  warning?: string;
}

/** 추천 코스 한 건 (metrics + 평가 정보 포함) */
export interface Recommendation {
  id: string;
  title: string;
  points: LatLngPoint[];
  routePath: LatLngPoint[];
  routePathSegments: LatLngPoint[][];
  totalDistanceMeters: number;
  totalDistanceKm: number;
  segmentDistancesMeters: number[];
  routeSource: RouteSource;
  warning?: string;
  score: number;
  reason: string;
}

/** POST /api/course/recommendations 응답 */
export interface RecommendationsResponse {
  startPoint: LatLngPoint;
  targetDistanceKm: number;
  recommendations: Recommendation[];
}

export interface RecommendationsParams {
  startPoint: LatLngPoint;
  targetDistanceKm: number;
  count?: number;
}
