import { computed, ref, watch } from 'vue';
import { fetchCourseMetrics, fetchCourseRecommendations } from '../services/courseApi';
import { showToast } from './useToast';

/** @typedef {{ lat: number; lng: number }} LatLngPoint */

const points = ref([]);
const totalDistanceMeters = ref(0);
const segmentDistancesMeters = ref([]);
const routePath = ref([]);
const routePathSegments = ref([]);
const highlightedSegmentIndex = ref(null);
const routeSource = ref('TMAP_PEDESTRIAN');
const isSyncing = ref(false);
const syncError = ref('');
const syncWarning = ref('');
const recommendationTargetKm = ref(5);
const recommendations = ref([]);
const recommendationError = ref('');
const isLoadingRecommendations = ref(false);

let requestSequence = 0;

function pointKeyForCompare(point) {
    return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
}

/**
 * API 또는 추천 응답의 구간 좌표 배열을 정규화합니다. 원본은 변경하지 않습니다.
 *
 * @param {unknown} raw
 * @returns {LatLngPoint[][]}
 */
function normalizeRoutePathSegments(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((segment) => {
            if (!Array.isArray(segment)) return [];
            return segment
                .map((point) => ({
                    lat: Number(point.lat),
                    lng: Number(point.lng),
                }))
                .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
        })
        .filter((segment) => segment.length >= 2);
}

/**
 * 연속 지점 사이를 직선 구간으로 나눕니다. (경로 세그먼트 폴백용)
 *
 * @param {readonly LatLngPoint[]} waypoints
 * @returns {LatLngPoint[][]}
 */
function straightSegmentPathFromPoints(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) return [];
    const segments = [];
    for (let index = 0; index < waypoints.length - 1; index += 1) {
        const fromPoint = waypoints[index];
        const toPoint = waypoints[index + 1];
        segments.push([
            { lat: Number(fromPoint.lat), lng: Number(fromPoint.lng) },
            { lat: Number(toPoint.lat), lng: Number(toPoint.lng) },
        ]);
    }
    return segments;
}

async function syncDistanceFromServer() {
    if (points.value.length < 2) {
        totalDistanceMeters.value = 0;
        segmentDistancesMeters.value = [];
        routePath.value = [...points.value];
        routePathSegments.value = [];
        highlightedSegmentIndex.value = null;
        routeSource.value = 'TMAP_PEDESTRIAN';
        syncError.value = '';
        syncWarning.value = '';
        return;
    }

    const currentSeq = ++requestSequence;
    isSyncing.value = true;

    try {
        const payload = await fetchCourseMetrics(points.value);

        if (currentSeq !== requestSequence) return;

        totalDistanceMeters.value = payload.totalDistanceMeters ?? 0;
        segmentDistancesMeters.value = Array.isArray(payload.segmentDistancesMeters)
            ? payload.segmentDistancesMeters.map((value) => Number(value || 0))
            : [];
        routePath.value = Array.isArray(payload.routePath) ? payload.routePath : [...points.value];
        let nextSegments = normalizeRoutePathSegments(payload.routePathSegments);
        if (nextSegments.length === 0 && points.value.length >= 2) {
            nextSegments = straightSegmentPathFromPoints(points.value);
        }
        routePathSegments.value = nextSegments;
        if (
            highlightedSegmentIndex.value !== null &&
            (highlightedSegmentIndex.value < 0 ||
                highlightedSegmentIndex.value >= routePathSegments.value.length)
        ) {
            highlightedSegmentIndex.value = null;
        }
        routeSource.value = payload.routeSource || 'TMAP_PEDESTRIAN';
        syncError.value = '';
        syncWarning.value = payload.warning || '';
    } catch (error) {
        if (currentSeq !== requestSequence) return;
        syncError.value = error.message || '백엔드 API와 연결되지 않아 거리 계산을 할 수 없습니다.';
        syncWarning.value = '';
        routePathSegments.value = [];
        highlightedSegmentIndex.value = null;
    } finally {
        if (currentSeq === requestSequence) {
            isSyncing.value = false;
        }
    }
}

watch(points, syncDistanceFromServer, { deep: true });

/**
 * 코스 지점·TMAP 동기화 거리·구간 강조·추천 목록 상태를 제공합니다.
 * 모듈 단일 인스턴스를 공유하므로, 지도와 패널에서 동일한 코스를 봅니다.
 *
 * @returns {{
 *   points: import('vue').Ref<LatLngPoint[]>;
 *   totalDistanceKm: import('vue').ComputedRef<string>;
 *   totalDistanceMeters: import('vue').Ref<number>;
 *   segmentDistancesMeters: import('vue').Ref<number[]>;
 *   routePath: import('vue').Ref<LatLngPoint[]>;
 *   routePathSegments: import('vue').Ref<LatLngPoint[][]>;
 *   highlightedSegmentIndex: import('vue').Ref<number | null>;
 *   routeSource: import('vue').Ref<string>;
 *   isSyncing: import('vue').Ref<boolean>;
 *   syncError: import('vue').Ref<string>;
 *   syncWarning: import('vue').Ref<string>;
 *   recommendationTargetKm: import('vue').Ref<number>;
 *   recommendations: import('vue').Ref<unknown[]>;
 *   recommendationError: import('vue').Ref<string>;
 *   isLoadingRecommendations: import('vue').Ref<boolean>;
 *   loadRecommendations: () => Promise<void>;
 *   applyRecommendation: (recommendation: Record<string, unknown>) => void;
 *   addPoint: (point: LatLngPoint) => void;
 *   removeLastPoint: () => void;
 *   clearPoints: () => void;
 *   toggleSegmentHighlight: (segmentIndex: number) => void;
 * }}
 */
export function useCoursePath() {
    const totalDistanceKm = computed(() => (totalDistanceMeters.value / 1000).toFixed(2));

    function addPoint(point) {
        const next = {
            lat: Number(point.lat),
            lng: Number(point.lng),
        };
        if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

        if (points.value.length > 0) {
            const last = points.value[points.value.length - 1];
            if (pointKeyForCompare(last) === pointKeyForCompare(next)) {
                showToast('바로 이전 지점과 같은 위치입니다. 경로를 만들 수 없어요.');
                return;
            }
        }

        points.value.push(next);
        routePath.value = [...points.value];
        recommendations.value = [];
        recommendationError.value = '';
    }

    function removeLastPoint() {
        if (points.value.length === 0) return;
        points.value.pop();
        routePath.value = [...points.value];
        recommendations.value = [];
        recommendationError.value = '';
    }

    function clearPoints() {
        requestSequence += 1;
        points.value = [];
        totalDistanceMeters.value = 0;
        segmentDistancesMeters.value = [];
        routePath.value = [];
        routePathSegments.value = [];
        highlightedSegmentIndex.value = null;
        routeSource.value = 'TMAP_PEDESTRIAN';
        syncError.value = '';
        syncWarning.value = '';
        recommendations.value = [];
        recommendationError.value = '';
        isSyncing.value = false;
    }

    async function loadRecommendations() {
        if (isLoadingRecommendations.value) return;

        if (points.value.length === 0) {
            recommendationError.value = '지도를 한 번 클릭해 출발 지점을 먼저 지정하세요.';
            recommendations.value = [];
            return;
        }

        recommendationError.value = '';
        isLoadingRecommendations.value = true;

        try {
            const payload = await fetchCourseRecommendations({
                startPoint: points.value[0],
                targetDistanceKm: recommendationTargetKm.value,
                count: 3,
            });

            recommendations.value = Array.isArray(payload.recommendations) ? payload.recommendations : [];
        } catch (error) {
            recommendationError.value = error.message || '추천 코스를 불러오지 못했습니다.';
            recommendations.value = [];
        } finally {
            isLoadingRecommendations.value = false;
        }
    }

    function applyRecommendation(recommendation) {
        if (!recommendation || !Array.isArray(recommendation.points)) return;

        requestSequence += 1;
        points.value = recommendation.points.map((point) => ({
            lat: Number(point.lat),
            lng: Number(point.lng),
        }));
        routePath.value = Array.isArray(recommendation.routePath)
            ? recommendation.routePath.map((point) => ({
                  lat: Number(point.lat),
                  lng: Number(point.lng),
              }))
            : [...points.value];
        totalDistanceMeters.value = Number(recommendation.totalDistanceMeters || 0);
        segmentDistancesMeters.value = Array.isArray(recommendation.segmentDistancesMeters)
            ? recommendation.segmentDistancesMeters.map((value) => Number(value || 0))
            : [];
        routeSource.value = recommendation.routeSource || 'TMAP_PEDESTRIAN';
        syncWarning.value = recommendation.warning || '';
        syncError.value = '';
        isSyncing.value = false;
        highlightedSegmentIndex.value = null;
        const normalizedSegments = normalizeRoutePathSegments(recommendation.routePathSegments);
        routePathSegments.value =
            normalizedSegments.length > 0 ? normalizedSegments : straightSegmentPathFromPoints(points.value);
    }

    function toggleSegmentHighlight(segmentIndex) {
        if (typeof segmentIndex !== 'number' || segmentIndex < 0) return;
        if (segmentIndex >= routePathSegments.value.length) return;
        if (highlightedSegmentIndex.value === segmentIndex) {
            highlightedSegmentIndex.value = null;
        } else {
            highlightedSegmentIndex.value = segmentIndex;
        }
    }

    return {
        points,
        totalDistanceKm,
        totalDistanceMeters,
        segmentDistancesMeters,
        routePath,
        routeSource,
        isSyncing,
        syncError,
        syncWarning,
        recommendationTargetKm,
        recommendations,
        recommendationError,
        isLoadingRecommendations,
        loadRecommendations,
        applyRecommendation,
        addPoint,
        removeLastPoint,
        clearPoints,
        routePathSegments,
        highlightedSegmentIndex,
        toggleSegmentHighlight,
    };
}
