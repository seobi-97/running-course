<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useCoursePath } from '../../composables/useCoursePath';
import { NAVER_MAP_DEFAULT } from '../../constants/naverMap';

const mapElement = ref(null);
const mapReady = ref(false);
const mapError = ref('');
const markers = [];
const markerClickListeners = [];

let map = null;
let polyline = null;
let polylineFocus = null;
let clickListener = null;
const OVERLAP_OFFSET_PX = 20;

/** 전체/강조 폴리라인 색·두께 */
const POLYLINE = {
    default: { strokeColor: '#16a34a', strokeOpacity: 0.8, strokeWeight: 5 },
    muted: { strokeColor: '#94a3b8', strokeOpacity: 0.6, strokeWeight: 5 },
    focus: { strokeColor: '#16a34a', strokeOpacity: 1, strokeWeight: 8 },
};

const { points, routePath, routePathSegments, highlightedSegmentIndex, totalDistanceKm, routeSource, isSyncing, addPoint } = useCoursePath();

const statusText = computed(() => {
    if (mapError.value) return 'SDK 로드 실패';
    if (mapReady.value) {
        const syncingText = isSyncing.value ? ' · 거리 계산 중' : '';
        const sourceText = routeSource.value === 'TMAP_PEDESTRIAN' ? '보행 경로' : '직선 대체 경로';
        return `${points.value.length}개 지점 · ${totalDistanceKm.value} km · ${sourceText}${syncingText}`;
    }
    return '지도 로딩 중';
});

function isNaverMapAvailable() {
    return typeof window !== 'undefined' && window.naver?.maps;
}

function pointKey(point) {
    return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
}

function getMarkerOffsetPx(overlapIndex, overlapCount) {
    if (overlapCount <= 1) return { x: 0, y: 0 };
    const angle = (2 * Math.PI * overlapIndex) / overlapCount;
    return {
        x: Math.round(Math.cos(angle) * OVERLAP_OFFSET_PX),
        y: Math.round(Math.sin(angle) * OVERLAP_OFFSET_PX),
    };
}

function disposePolylines() {
    if (polyline) {
        polyline.setMap(null);
        polyline = null;
    }
    if (polylineFocus) {
        polylineFocus.setMap(null);
        polylineFocus = null;
    }
}

function syncMarkersAndLine() {
    if (!map || !isNaverMapAvailable()) return;

    markerClickListeners.forEach((listener) => window.naver.maps.Event.removeListener(listener));
    markerClickListeners.length = 0;
    markers.forEach((marker) => marker.setMap(null));
    markers.length = 0;

    const pointCountByKey = new Map();
    for (const point of points.value) {
        const key = pointKey(point);
        pointCountByKey.set(key, (pointCountByKey.get(key) ?? 0) + 1);
    }
    const renderedCountByKey = new Map();

    for (const [index, point] of points.value.entries()) {
        const markerNumber = index + 1;
        const key = pointKey(point);
        const overlapCount = pointCountByKey.get(key) ?? 1;
        const overlapIndex = renderedCountByKey.get(key) ?? 0;
        renderedCountByKey.set(key, overlapIndex + 1);
        const markerOffset = getMarkerOffsetPx(overlapIndex, overlapCount);
        const marker = new window.naver.maps.Marker({
            position: new window.naver.maps.LatLng(point.lat, point.lng),
            icon: {
                content: `
          <div class="course-marker" style="transform: translate(${markerOffset.x}px, ${markerOffset.y}px);">
            <span>${markerNumber}</span>
          </div>
        `,
                anchor: new window.naver.maps.Point(15, 15),
            },
            map,
        });
        const markerClickListener = window.naver.maps.Event.addListener(marker, 'click', () => {
            addPoint({
                lat: point.lat,
                lng: point.lng,
            });
        });
        markerClickListeners.push(markerClickListener);
        markers.push(marker);
    }

    const linePoints = routePath.value.length >= 2 ? routePath.value : points.value;
    if (linePoints.length < 2) {
        disposePolylines();
        return;
    }

    const fullPath = linePoints.map((point) => new window.naver.maps.LatLng(point.lat, point.lng));
    const segmentIndex = highlightedSegmentIndex.value;
    const segments = routePathSegments.value;
    const focusSegment = typeof segmentIndex === 'number' && segmentIndex >= 0 && segmentIndex < segments.length ? segments[segmentIndex] : null;
    const focusValid = Array.isArray(focusSegment) && focusSegment.length >= 2;

    disposePolylines();

    if (focusValid) {
        polyline = new window.naver.maps.Polyline({
            map,
            path: fullPath,
            ...POLYLINE.muted,
        });
        const focusPath = focusSegment.map((point) => new window.naver.maps.LatLng(point.lat, point.lng));
        polylineFocus = new window.naver.maps.Polyline({
            map,
            path: focusPath,
            ...POLYLINE.focus,
        });
        return;
    }

    polyline = new window.naver.maps.Polyline({
        map,
        path: fullPath,
        ...POLYLINE.default,
    });
}

onMounted(() => {
    if (!isNaverMapAvailable()) {
        mapError.value = '네이버 지도 SDK를 찾을 수 없습니다. Client ID와 스크립트 로딩을 확인하세요.';
        return;
    }

    map = new window.naver.maps.Map(mapElement.value, {
        center: new window.naver.maps.LatLng(NAVER_MAP_DEFAULT.center.lat, NAVER_MAP_DEFAULT.center.lng),
        zoom: NAVER_MAP_DEFAULT.zoom,
        zoomControl: NAVER_MAP_DEFAULT.zoomControl,
        minZoom: NAVER_MAP_DEFAULT.minZoom,
    });
    mapReady.value = true;

    clickListener = window.naver.maps.Event.addListener(map, 'click', (event) => {
        addPoint({
            lat: event.coord.y,
            lng: event.coord.x,
        });
    });

    syncMarkersAndLine();
});

watch([points, routePath, routePathSegments, highlightedSegmentIndex], syncMarkersAndLine, { deep: true });

onBeforeUnmount(() => {
    if (clickListener && isNaverMapAvailable()) {
        window.naver.maps.Event.removeListener(clickListener);
    }
    markerClickListeners.forEach((listener) => window.naver.maps.Event.removeListener(listener));
    markerClickListeners.length = 0;

    markers.forEach((marker) => marker.setMap(null));
    markers.length = 0;

    disposePolylines();
});
</script>

<template>
    <v-card>
        <v-card-title class="d-flex flex-wrap align-center justify-space-between gap-2 pb-2">
            <span class="d-flex align-center gap-2">
                <v-icon color="primary" icon="mdi-map" />
                지도
            </span>
            <v-chip color="secondary" size="small" variant="tonal" class="text-caption font-weight-medium">
                {{ statusText }}
            </v-chip>
        </v-card-title>
        <v-card-text class="pt-0">
            <v-alert v-if="mapError" type="error" variant="tonal" density="compact" class="mb-3" rounded="lg">
                {{ mapError }}
            </v-alert>
            <div ref="mapElement" id="naver-map" class="map-canvas" />
            <p class="text-body-2 text-medium-emphasis mt-3 mb-0">
                지도를 클릭해서 러닝 코스 지점을 추가하세요. 총 거리와 경로는 TMAP 보행 API 기준으로 계산합니다.
            </p>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.map-canvas {
    min-height: 520px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(var(--v-border-color), 0.12);
    background: rgb(var(--v-theme-surface-variant));
}

:deep(.course-marker) {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: rgb(var(--v-theme-secondary));
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
}
</style>
