import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCourseMetrics, fetchCourseRecommendations } from '@/services/courseApi';
import {
  normalizePoint,
  normalizeRoutePathSegments,
  pointKeyForCompare,
  straightSegmentPathFromPoints,
} from '@/lib/routePath';
import { showToast } from '@/lib/toast';
import type {
  CourseMetrics,
  LatLngPoint,
  Recommendation,
  RouteSource,
} from '@/types/course';

const METRICS_KEY = 'course-metrics';

/** points 배열로 metrics 쿼리 키를 만든다. */
function metricsQueryKey(points: LatLngPoint[]) {
  return [METRICS_KEY, points] as const;
}

/** 추천 코스 → metrics 캐시 시딩용 객체로 변환한다. */
function metricsFromRecommendation(recommendation: Recommendation, points: LatLngPoint[]): CourseMetrics {
  const normalizedSegments = normalizeRoutePathSegments(recommendation.routePathSegments);
  return {
    totalDistanceMeters: Number(recommendation.totalDistanceMeters || 0),
    segmentDistancesMeters: Array.isArray(recommendation.segmentDistancesMeters)
      ? recommendation.segmentDistancesMeters.map((value) => Number(value || 0))
      : [],
    routePath: Array.isArray(recommendation.routePath)
      ? recommendation.routePath.map(normalizePoint)
      : [...points],
    routePathSegments:
      normalizedSegments.length > 0 ? normalizedSegments : straightSegmentPathFromPoints(points),
    routeSource: recommendation.routeSource || 'TMAP_PEDESTRIAN',
    warning: recommendation.warning || '',
  };
}

export interface CourseContextValue {
  // 상태
  points: LatLngPoint[];
  totalDistanceKm: string;
  totalDistanceMeters: number;
  segmentDistancesMeters: number[];
  routePath: LatLngPoint[];
  routePathSegments: LatLngPoint[][];
  highlightedSegmentIndex: number | null;
  routeSource: RouteSource;
  isSyncing: boolean;
  syncError: string;
  syncWarning: string;
  recommendationTargetKm: number;
  recommendations: Recommendation[];
  recommendationError: string;
  isLoadingRecommendations: boolean;
  // 액션
  setRecommendationTargetKm: (km: number) => void;
  addPoint: (point: LatLngPoint) => void;
  removeLastPoint: () => void;
  clearPoints: () => void;
  loadRecommendations: () => void;
  applyRecommendation: (recommendation: Recommendation) => void;
  toggleSegmentHighlight: (segmentIndex: number) => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [points, setPoints] = useState<LatLngPoint[]>([]);
  const [recommendationTargetKm, setRecommendationTargetKm] = useState(5);
  const [highlightedSegmentIndex, setHighlightedSegmentIndex] = useState<number | null>(null);
  const [recommendationError, setRecommendationError] = useState('');

  // ── 거리/경로 계산: points 를 키로 하는 쿼리 (staleTime Infinity → 지점 불변 시 재요청 없음)
  const metricsQuery = useQuery({
    queryKey: metricsQueryKey(points),
    queryFn: ({ queryKey }) => fetchCourseMetrics(queryKey[1] as LatLngPoint[]),
    enabled: points.length >= 2,
  });

  // ── 추천 코스: 버튼 트리거 mutation
  const recommendationsMutation = useMutation({
    mutationFn: fetchCourseRecommendations,
    onSuccess: () => setRecommendationError(''),
    onError: (error: Error) =>
      setRecommendationError(error.message || '추천 코스를 불러오지 못했습니다.'),
  });

  // ── 파생 상태 (points + 쿼리 결과에서 계산)
  const derived = useMemo(() => {
    const hasEnoughPoints = points.length >= 2;
    const data = metricsQuery.data;

    if (!hasEnoughPoints) {
      return {
        totalDistanceMeters: 0,
        segmentDistancesMeters: [] as number[],
        routePath: [...points],
        routePathSegments: [] as LatLngPoint[][],
        routeSource: 'TMAP_PEDESTRIAN' as RouteSource,
        syncWarning: '',
      };
    }

    // 계산 실패 시: 클릭한 지점만 직선으로 노출하고 에러는 별도 표시
    if (metricsQuery.isError || !data) {
      return {
        totalDistanceMeters: 0,
        segmentDistancesMeters: [] as number[],
        routePath: [...points],
        routePathSegments: metricsQuery.isError ? [] : straightSegmentPathFromPoints(points),
        routeSource: 'TMAP_PEDESTRIAN' as RouteSource,
        syncWarning: '',
      };
    }

    const normalizedSegments = normalizeRoutePathSegments(data.routePathSegments);
    return {
      totalDistanceMeters: data.totalDistanceMeters ?? 0,
      segmentDistancesMeters: Array.isArray(data.segmentDistancesMeters)
        ? data.segmentDistancesMeters.map((value) => Number(value || 0))
        : [],
      routePath: Array.isArray(data.routePath) && data.routePath.length >= 2 ? data.routePath : [...points],
      routePathSegments:
        normalizedSegments.length > 0 ? normalizedSegments : straightSegmentPathFromPoints(points),
      routeSource: data.routeSource || 'TMAP_PEDESTRIAN',
      syncWarning: data.warning || '',
    };
  }, [points, metricsQuery.data, metricsQuery.isError]);

  const syncError = metricsQuery.isError
    ? (metricsQuery.error as Error).message || '백엔드 API와 연결되지 않아 거리 계산을 할 수 없습니다.'
    : '';

  // 강조 구간이 범위를 벗어나면 해제
  const safeHighlightIndex =
    highlightedSegmentIndex !== null &&
    highlightedSegmentIndex >= 0 &&
    highlightedSegmentIndex < derived.routePathSegments.length
      ? highlightedSegmentIndex
      : null;

  const addPoint = useCallback((point: LatLngPoint) => {
    const next = normalizePoint(point);
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    setPoints((prev) => {
      if (prev.length > 0 && pointKeyForCompare(prev[prev.length - 1]) === pointKeyForCompare(next)) {
        showToast('바로 이전 지점과 같은 위치입니다. 경로를 만들 수 없어요.');
        return prev;
      }
      return [...prev, next];
    });
    recommendationsMutation.reset();
    setRecommendationError('');
  }, [recommendationsMutation]);

  const removeLastPoint = useCallback(() => {
    setPoints((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
    recommendationsMutation.reset();
    setRecommendationError('');
  }, [recommendationsMutation]);

  const clearPoints = useCallback(() => {
    setPoints([]);
    setHighlightedSegmentIndex(null);
    recommendationsMutation.reset();
    setRecommendationError('');
  }, [recommendationsMutation]);

  const loadRecommendations = useCallback(() => {
    if (recommendationsMutation.isPending) return;
    if (points.length === 0) {
      setRecommendationError('지도를 한 번 클릭해 출발 지점을 먼저 지정하세요.');
      recommendationsMutation.reset();
      return;
    }
    setRecommendationError('');
    recommendationsMutation.mutate({
      startPoint: points[0],
      targetDistanceKm: recommendationTargetKm,
      count: 3,
    });
  }, [points, recommendationTargetKm, recommendationsMutation]);

  const applyRecommendation = useCallback(
    (recommendation: Recommendation) => {
      if (!recommendation || !Array.isArray(recommendation.points)) return;
      const nextPoints = recommendation.points.map(normalizePoint);
      // metrics 를 미리 캐시에 심어 재요청 없이 즉시 반영
      queryClient.setQueryData(
        metricsQueryKey(nextPoints),
        metricsFromRecommendation(recommendation, nextPoints)
      );
      setPoints(nextPoints);
      setHighlightedSegmentIndex(null);
    },
    [queryClient]
  );

  const toggleSegmentHighlight = useCallback((segmentIndex: number) => {
    if (typeof segmentIndex !== 'number' || segmentIndex < 0) return;
    setHighlightedSegmentIndex((prev) => (prev === segmentIndex ? null : segmentIndex));
  }, []);

  const value = useMemo<CourseContextValue>(
    () => ({
      points,
      totalDistanceKm: (derived.totalDistanceMeters / 1000).toFixed(2),
      totalDistanceMeters: derived.totalDistanceMeters,
      segmentDistancesMeters: derived.segmentDistancesMeters,
      routePath: derived.routePath,
      routePathSegments: derived.routePathSegments,
      highlightedSegmentIndex: safeHighlightIndex,
      routeSource: derived.routeSource,
      isSyncing: points.length >= 2 && metricsQuery.isFetching,
      syncError,
      syncWarning: derived.syncWarning,
      recommendationTargetKm,
      recommendations: recommendationsMutation.data?.recommendations ?? [],
      recommendationError,
      isLoadingRecommendations: recommendationsMutation.isPending,
      setRecommendationTargetKm,
      addPoint,
      removeLastPoint,
      clearPoints,
      loadRecommendations,
      applyRecommendation,
      toggleSegmentHighlight,
    }),
    [
      points,
      derived,
      safeHighlightIndex,
      syncError,
      recommendationTargetKm,
      recommendationsMutation.data,
      recommendationsMutation.isPending,
      recommendationError,
      metricsQuery.isFetching,
      addPoint,
      removeLastPoint,
      clearPoints,
      loadRecommendations,
      applyRecommendation,
      toggleSegmentHighlight,
    ]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

/** 공유 코스 상태에 접근하는 훅 (기존 Vue useCoursePath 대응) */
export function useCourse(): CourseContextValue {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
}
