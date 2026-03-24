import { computed, ref, watch } from 'vue';
import { fetchCourseMetrics, fetchCourseRecommendations } from '../services/courseApi';

const points = ref([]);
const totalDistanceMeters = ref(0);
const segmentDistancesMeters = ref([]);
const routePath = ref([]);
const routeSource = ref('TMAP_PEDESTRIAN');
const isSyncing = ref(false);
const syncError = ref('');
const syncWarning = ref('');
const recommendationTargetKm = ref(5);
const recommendations = ref([]);
const recommendationError = ref('');
const isLoadingRecommendations = ref(false);

let requestSequence = 0;

async function syncDistanceFromServer() {
    if (points.value.length < 2) {
        totalDistanceMeters.value = 0;
        segmentDistancesMeters.value = [];
        routePath.value = [...points.value];
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
        routeSource.value = payload.routeSource || 'TMAP_PEDESTRIAN';
        syncError.value = '';
        syncWarning.value = payload.warning || '';
    } catch (error) {
        if (currentSeq !== requestSequence) return;
        syncError.value = error.message || '백엔드 API와 연결되지 않아 거리 계산을 할 수 없습니다.';
        syncWarning.value = '';
    } finally {
        if (currentSeq === requestSequence) {
            isSyncing.value = false;
        }
    }
}

watch(points, syncDistanceFromServer, { deep: true });

export function useCoursePath() {
    const totalDistanceKm = computed(() => (totalDistanceMeters.value / 1000).toFixed(2));

    function addPoint(point) {
        points.value.push(point);
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
    };
}
