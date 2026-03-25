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
let clickListener = null;
const OVERLAP_OFFSET_PX = 20;

const { points, routePath, totalDistanceKm, routeSource, isSyncing, addPoint } = useCoursePath();

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
        if (polyline) {
            polyline.setMap(null);
            polyline = null;
        }
        return;
    }

    const path = linePoints.map((point) => new window.naver.maps.LatLng(point.lat, point.lng));

    if (!polyline) {
        polyline = new window.naver.maps.Polyline({
            map,
            path,
            strokeColor: '#16a34a',
            strokeOpacity: 0.85,
            strokeWeight: 5,
        });
        return;
    }

    polyline.setPath(path);
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

watch([points, routePath], syncMarkersAndLine, { deep: true });

onBeforeUnmount(() => {
    if (clickListener && isNaverMapAvailable()) {
        window.naver.maps.Event.removeListener(clickListener);
    }
    markerClickListeners.forEach((listener) => window.naver.maps.Event.removeListener(listener));
    markerClickListeners.length = 0;

    markers.forEach((marker) => marker.setMap(null));
    markers.length = 0;

    if (polyline) {
        polyline.setMap(null);
        polyline = null;
    }
});
</script>

<template>
    <section class="map-card">
        <div class="map-header">
            <h2>지도</h2>
            <span>{{ statusText }}</span>
        </div>
        <p v-if="mapError" class="map-error">{{ mapError }}</p>
        <div ref="mapElement" id="naver-map" class="map-canvas"></div>
        <div class="map-guide">지도를 클릭해서 러닝 코스 지점을 추가하세요. 총 거리와 경로는 TMAP 보행 API 기준으로 계산합니다.</div>
    </section>
</template>

<style scoped>
.map-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 14px;
}

.map-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
}

.map-header h2 {
    margin: 0;
    font-size: 18px;
}

.map-header span {
    font-size: 13px;
    color: #6b7280;
}

.map-canvas {
    min-height: 520px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #f8fafc;
}

.map-guide {
    margin: 10px 2px 0;
    font-size: 13px;
    color: #475569;
}

.map-error {
    margin: 0 0 10px;
    color: #b91c1c;
    font-size: 13px;
}

:deep(.course-marker) {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 2px solid #ffffff;
    background: #2563eb;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
}
</style>
