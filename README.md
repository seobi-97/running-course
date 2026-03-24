# Running Course Planner (Front/Back)

`running-course`를 프론트엔드(Vue)와 백엔드(Node.js)로 분리한 구조입니다.

## 프로젝트 구조

```text
running-course
├─ front
│  ├─ index.html
│  ├─ package.json
│  ├─ vite.config.js
│  └─ src
│     ├─ components
│     ├─ composables
│     ├─ constants
│     ├─ services
│     └─ ...
├─ back
│  ├─ package.json
│  └─ src
│     ├─ server.js
│     └─ distance.js
└─ package.json
```

## 설치

루트에서 한 번에 설치:

```bash
npm run install:all
```

또는 각각 설치:

```bash
npm install --prefix front
npm install --prefix back
```

## 실행

한 번에 실행:

```bash
npm run dev
```

개별 실행:

```bash
npm run dev:back
npm run dev:front
```

프론트: `http://localhost:5173`
백엔드: `http://localhost:4100`

## 환경 변수

`front/.env`

```env
VITE_NAVER_MAP_CLIENT_ID=YOUR_NAVER_MAP_CLIENT_ID
```

`back/.env`

```env
PORT=4100
TMAP_API_KEY=YOUR_TMAP_APP_KEY
```

`front/.env.development` (선택)

```env
VITE_API_PROXY_TARGET=http://localhost:4100
```

## API

- `GET /api/health`
- `POST /api/course/metrics`
  - body: `{ "points": [{ "lat": 37.5, "lng": 126.9 }] }`
  - response: `{ pointCount, totalDistanceMeters, totalDistanceKm, routePath, routeSource }`
- `POST /api/course/recommendations`
  - body: `{ "startPoint": { "lat": 37.5, "lng": 126.9 }, "targetDistanceKm": 5, "count": 3 }`
  - response: `{ startPoint, targetDistanceKm, recommendations[] }`

`/api/course/metrics`는 TMAP 보행 경로 API를 호출해서 실제 보행 거리/경로를 계산합니다.
