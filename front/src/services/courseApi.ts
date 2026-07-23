import type {
  CourseMetrics,
  LatLngPoint,
  RecommendationsParams,
  RecommendationsResponse,
} from '@/types/course';

/** 에러 응답 본문에서 message 를 최대한 추출한다. */
async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return `${fallback}: HTTP ${response.status}`;
}

/** 지점 목록으로 총 거리·경로를 계산한다. (POST /api/course/metrics) */
export async function fetchCourseMetrics(points: LatLngPoint[]): Promise<CourseMetrics> {
  const response = await fetch('/api/course/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, '거리 계산 요청 실패'));
  }

  return response.json() as Promise<CourseMetrics>;
}

/** 시작 지점·목표 거리로 추천 코스를 요청한다. (POST /api/course/recommendations) */
export async function fetchCourseRecommendations({
  startPoint,
  targetDistanceKm,
  count = 3,
}: RecommendationsParams): Promise<RecommendationsResponse> {
  const response = await fetch('/api/course/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startPoint, targetDistanceKm, count }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, '추천 코스 요청 실패'));
  }

  return response.json() as Promise<RecommendationsResponse>;
}
