/**
 * 네이버 지도 SDK는 index.html 의 <script> 태그로 로드되어 전역 `window.naver` 로 노출된다.
 * npm 패키지/공식 타입이 없으므로 사용하는 부분만 최소한으로 선언한다.
 */
declare global {
  interface Window {
    naver?: typeof naver;
  }

  namespace naver.maps {
    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    class Point {
      constructor(x: number, y: number);
    }

    interface MapOptions {
      center: LatLng;
      zoom: number;
      zoomControl?: boolean;
      minZoom?: number;
    }

    class Map {
      constructor(element: HTMLElement | string, options: MapOptions);
      setCenter(latlng: LatLng): void;
      setZoom(zoom: number): void;
    }

    interface MarkerIcon {
      content: string;
      anchor?: Point;
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map | null;
      icon?: MarkerIcon | string;
    }

    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
    }

    interface PolylineOptions {
      map?: Map | null;
      path: LatLng[];
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
    }

    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
    }

    interface PointerEvent {
      coord: { x: number; y: number };
    }

    type MapEventListener = unknown;

    namespace Event {
      function addListener(
        target: unknown,
        eventName: string,
        handler: (event: PointerEvent) => void
      ): MapEventListener;
      function removeListener(listener: MapEventListener): void;
    }
  }
}

export {};
