import type { LatLngPoint } from '@/types/course';

interface NaverMapDefault {
  center: LatLngPoint;
  zoom: number;
  zoomControl: boolean;
  minZoom: number;
}

/** 지도 초기 설정값 (서울시청 기준) */
export const NAVER_MAP_DEFAULT: NaverMapDefault = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 13,
  zoomControl: true,
  minZoom: 6,
};
