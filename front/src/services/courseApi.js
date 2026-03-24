export async function fetchCourseMetrics(points) {
    const response = await fetch('/api/course/metrics', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || `거리 계산 요청 실패: ${response.status}`);
    }

    return response.json();
}

export async function fetchCourseRecommendations({ startPoint, targetDistanceKm, count = 3 }) {
    const response = await fetch('/api/course/recommendations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startPoint, targetDistanceKm, count }),
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message || `추천 코스 요청 실패: ${response.status}`);
    }

    return response.json();
}
