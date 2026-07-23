import { useEffect, useRef, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { useCourse } from '@/context/CourseContext';
import { NAVER_MAP_DEFAULT } from '@/constants/naverMap';
import type { LatLngPoint } from '@/types/course';

const OVERLAP_OFFSET_PX = 20;

/** 전체/강조 폴리라인 색·두께 */
const POLYLINE = {
  default: { strokeColor: '#16a34a', strokeOpacity: 0.8, strokeWeight: 5 },
  muted: { strokeColor: '#94a3b8', strokeOpacity: 0.6, strokeWeight: 5 },
  focus: { strokeColor: '#16a34a', strokeOpacity: 1, strokeWeight: 8 },
} as const;

function isNaverMapAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.naver?.maps);
}

function pointKey(point: LatLngPoint): string {
  return `${Number(point.lat).toFixed(6)},${Number(point.lng).toFixed(6)}`;
}

/** 같은 위치 마커가 겹칠 때 원형으로 분산 배치할 픽셀 오프셋 */
function getMarkerOffsetPx(overlapIndex: number, overlapCount: number): { x: number; y: number } {
  if (overlapCount <= 1) return { x: 0, y: 0 };
  const angle = (2 * Math.PI * overlapIndex) / overlapCount;
  return {
    x: Math.round(Math.cos(angle) * OVERLAP_OFFSET_PX),
    y: Math.round(Math.sin(angle) * OVERLAP_OFFSET_PX),
  };
}

export function NaverMapView() {
  const {
    points,
    routePath,
    routePathSegments,
    highlightedSegmentIndex,
    totalDistanceKm,
    routeSource,
    isSyncing,
    addPoint,
  } = useCourse();

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const polylineRef = useRef<naver.maps.Polyline | null>(null);
  const polylineFocusRef = useRef<naver.maps.Polyline | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const markerListenersRef = useRef<naver.maps.MapEventListener[]>([]);
  const clickListenerRef = useRef<naver.maps.MapEventListener | null>(null);

  // 클릭 리스너가 항상 최신 addPoint 를 호출하도록 ref 로 보관
  const addPointRef = useRef(addPoint);
  addPointRef.current = addPoint;

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  const statusText = (() => {
    if (mapError) return 'SDK 로드 실패';
    if (mapReady) {
      const syncingText = isSyncing ? ' · 거리 계산 중' : '';
      const sourceText = routeSource === 'TMAP_PEDESTRIAN' ? '보행 경로' : '직선 대체 경로';
      return `${points.length}개 지점 · ${totalDistanceKm} km · ${sourceText}${syncingText}`;
    }
    return '지도 로딩 중';
  })();

  // ── 지도 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!isNaverMapAvailable()) {
      setMapError('네이버 지도 SDK를 찾을 수 없습니다. Client ID와 스크립트 로딩을 확인하세요.');
      return;
    }
    if (!mapElementRef.current) return;

    const maps = window.naver!.maps;
    const map = new maps.Map(mapElementRef.current, {
      center: new maps.LatLng(NAVER_MAP_DEFAULT.center.lat, NAVER_MAP_DEFAULT.center.lng),
      zoom: NAVER_MAP_DEFAULT.zoom,
      zoomControl: NAVER_MAP_DEFAULT.zoomControl,
      minZoom: NAVER_MAP_DEFAULT.minZoom,
    });
    mapRef.current = map;
    setMapReady(true);

    clickListenerRef.current = maps.Event.addListener(map, 'click', (event) => {
      addPointRef.current({ lat: event.coord.y, lng: event.coord.x });
    });

    return () => {
      if (clickListenerRef.current) maps.Event.removeListener(clickListenerRef.current);
      markerListenersRef.current.forEach((listener) => maps.Event.removeListener(listener));
      markerListenersRef.current = [];
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (polylineFocusRef.current) polylineFocusRef.current.setMap(null);
      polylineRef.current = null;
      polylineFocusRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // ── 마커·폴리라인 동기화 (상태 변경 시)
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !isNaverMapAvailable()) return;
    const maps = window.naver!.maps;

    // 기존 마커/리스너 제거
    markerListenersRef.current.forEach((listener) => maps.Event.removeListener(listener));
    markerListenersRef.current = [];
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // 겹치는 지점 개수 집계
    const countByKey = new Map<string, number>();
    for (const point of points) {
      const key = pointKey(point);
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    }
    const renderedByKey = new Map<string, number>();

    points.forEach((point, index) => {
      const key = pointKey(point);
      const overlapCount = countByKey.get(key) ?? 1;
      const overlapIndex = renderedByKey.get(key) ?? 0;
      renderedByKey.set(key, overlapIndex + 1);
      const offset = getMarkerOffsetPx(overlapIndex, overlapCount);
      const marker = new maps.Marker({
        position: new maps.LatLng(point.lat, point.lng),
        icon: {
          content: `<div class="course-marker" style="transform: translate(${offset.x}px, ${offset.y}px);"><span>${index + 1}</span></div>`,
          anchor: new maps.Point(15, 15),
        },
        map,
      });
      const listener = maps.Event.addListener(marker, 'click', () => {
        addPointRef.current({ lat: point.lat, lng: point.lng });
      });
      markerListenersRef.current.push(listener);
      markersRef.current.push(marker);
    });

    const disposePolylines = () => {
      if (polylineRef.current) polylineRef.current.setMap(null);
      if (polylineFocusRef.current) polylineFocusRef.current.setMap(null);
      polylineRef.current = null;
      polylineFocusRef.current = null;
    };

    const linePoints = routePath.length >= 2 ? routePath : points;
    if (linePoints.length < 2) {
      disposePolylines();
      return;
    }

    const fullPath = linePoints.map((point) => new maps.LatLng(point.lat, point.lng));
    const focusSegment =
      highlightedSegmentIndex !== null &&
      highlightedSegmentIndex >= 0 &&
      highlightedSegmentIndex < routePathSegments.length
        ? routePathSegments[highlightedSegmentIndex]
        : null;
    const focusValid = Array.isArray(focusSegment) && focusSegment.length >= 2;

    disposePolylines();

    if (focusValid && focusSegment) {
      polylineRef.current = new maps.Polyline({ map, path: fullPath, ...POLYLINE.muted });
      const focusPath = focusSegment.map((point) => new maps.LatLng(point.lat, point.lng));
      polylineFocusRef.current = new maps.Polyline({ map, path: focusPath, ...POLYLINE.focus });
      return;
    }

    polylineRef.current = new maps.Polyline({ map, path: fullPath, ...POLYLINE.default });
  }, [mapReady, points, routePath, routePathSegments, highlightedSegmentIndex]);

  return (
    <Card className="lg:flex lg:h-full lg:flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <MapIcon className="text-primary" />
            지도
          </span>
          <Badge variant="secondary" className="font-medium">
            {statusText}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        {mapError ? (
          <Alert variant="destructive" className="mb-3">
            {mapError}
          </Alert>
        ) : null}
        <div
          ref={mapElementRef}
          id="naver-map"
          className="min-h-[520px] overflow-hidden rounded-xl border bg-muted lg:min-h-0 lg:flex-1"
        />
        <p className="mb-0 mt-3 text-sm text-muted-foreground">
          지도를 클릭해서 러닝 코스 지점을 추가하세요. 총 거리와 경로는 TMAP 보행 API 기준으로 계산합니다.
        </p>
      </CardContent>
    </Card>
  );
}
