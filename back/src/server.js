import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { distanceInMeters } from './distance.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4100);
const tmapApiKey = process.env.TMAP_API_KEY;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

const segmentCache = new Map();

async function withRetry(fn, maxRetries = 2, baseDelayMs = 400) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
            }
        }
    }
    throw lastError;
}

function isValidPoint(point) {
    if (!point || typeof point !== 'object') return false;

    const { lat, lng } = point;
    return Number.isFinite(lat) && Number.isFinite(lng);
}

function normalizePoint(point) {
    return {
        lat: Number(point.lat),
        lng: Number(point.lng),
    };
}

function pointCacheKey(point) {
    return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function segmentCacheKey(start, end) {
    return `${pointCacheKey(start)}|${pointCacheKey(end)}`;
}

function dedupePath(path) {
    const deduped = [];
    for (const point of path) {
        const previous = deduped[deduped.length - 1];
        if (!previous || previous.lat !== point.lat || previous.lng !== point.lng) {
            deduped.push(point);
        }
    }
    return deduped;
}

function parseRoutePath(features) {
    const routePath = [];

    for (const feature of features) {
        const coordinates = feature?.geometry?.coordinates;
        const type = feature?.geometry?.type;

        if (type !== 'LineString' || !Array.isArray(coordinates)) continue;

        for (const coordinate of coordinates) {
            if (!Array.isArray(coordinate) || coordinate.length < 2) continue;

            const [lng, lat] = coordinate;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                routePath.push({ lat, lng });
            }
        }
    }

    return dedupePath(routePath);
}

function parseTotalDistance(features, routePath) {
    const totalFromFeature = features.find((feature) => Number.isFinite(feature?.properties?.totalDistance))?.properties?.totalDistance;

    if (Number.isFinite(totalFromFeature)) {
        return Math.round(totalFromFeature);
    }

    if (routePath.length < 2) {
        return 0;
    }

    let total = 0;
    for (let index = 0; index < routePath.length - 1; index += 1) {
        total += distanceInMeters(routePath[index], routePath[index + 1]);
    }

    return Math.round(total);
}

function buildStraightLineMetrics(points) {
    if (points.length < 2) {
        return {
            totalDistanceMeters: 0,
            segmentDistancesMeters: [],
            routePath: points,
            routePathSegments: [],
        };
    }

    let totalDistanceMeters = 0;
    const segmentDistancesMeters = [];
    const routePathSegments = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const segmentDistance = distanceInMeters(points[index], points[index + 1]);
        totalDistanceMeters += segmentDistance;
        segmentDistancesMeters.push(Math.round(segmentDistance));
        routePathSegments.push([points[index], points[index + 1]]);
    }

    return {
        totalDistanceMeters: Math.round(totalDistanceMeters),
        segmentDistancesMeters,
        routePath: points,
        routePathSegments,
    };
}

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
    return (radians * 180) / Math.PI;
}

function destinationPoint(start, bearingDegrees, distanceMeters) {
    const earthRadius = 6371000;
    const bearing = toRadians(bearingDegrees);
    const lat1 = toRadians(start.lat);
    const lng1 = toRadians(start.lng);
    const angularDistance = distanceMeters / earthRadius;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing));

    const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1), Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2));

    return {
        lat: Number(toDegrees(lat2).toFixed(6)),
        lng: Number(toDegrees(lng2).toFixed(6)),
    };
}

function buildRecommendationCandidates(startPoint, targetDistanceMeters) {
    // 등변삼각형 루프: 도로 실거리 ≈ 직선 * 1.25 → 각 꼭짓점까지 직선 ≈ target / (3 * 1.25) ≈ 0.267
    // 꼭짓점 간 각도 차이 60° (등변삼각형)
    // 넓은 루프(이등변삼각형): 꼭짓점 간 각도 차이 90°~120°, ratio 0.30
    // 사각형 루프(3개 중간점): 모서리 비율 0.20, 대각 0.28
    const templates = [
        { title: '북동 삼각 루프', bearings: [10, 70], ratios: [0.27, 0.27] },
        { title: '동남 삼각 루프', bearings: [100, 160], ratios: [0.27, 0.27] },
        { title: '남서 삼각 루프', bearings: [190, 250], ratios: [0.27, 0.27] },
        { title: '서북 삼각 루프', bearings: [280, 340], ratios: [0.27, 0.27] },
        { title: '북쪽 넓은 루프', bearings: [300, 60], ratios: [0.3, 0.3] },
        { title: '남쪽 넓은 루프', bearings: [120, 240], ratios: [0.3, 0.3] },
        { title: '시계방향 사각 루프', bearings: [0, 45, 90], ratios: [0.2, 0.28, 0.2] },
        { title: '반시계 사각 루프', bearings: [0, 315, 270], ratios: [0.2, 0.28, 0.2] },
    ];

    return templates.map((template, index) => {
        const waypoints = template.bearings.map((bearing, waypointIndex) => destinationPoint(startPoint, bearing, targetDistanceMeters * template.ratios[waypointIndex]));

        return {
            id: `candidate-${index + 1}`,
            title: template.title,
            points: [startPoint, ...waypoints, startPoint],
        };
    });
}

function headingDegrees(a, b) {
    const y = Math.sin(toRadians(b.lng - a.lng)) * Math.cos(toRadians(b.lat));
    const x = Math.cos(toRadians(a.lat)) * Math.sin(toRadians(b.lat)) - Math.sin(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.cos(toRadians(b.lng - a.lng));

    const degrees = toDegrees(Math.atan2(y, x));
    return (degrees + 360) % 360;
}

function countSharpTurns(path) {
    if (!Array.isArray(path) || path.length < 3) return 0;

    let sharpTurnCount = 0;
    for (let index = 1; index < path.length - 1; index += 1) {
        const h1 = headingDegrees(path[index - 1], path[index]);
        const h2 = headingDegrees(path[index], path[index + 1]);
        let diff = Math.abs(h2 - h1);
        if (diff > 180) diff = 360 - diff;

        if (diff >= 55) {
            sharpTurnCount += 1;
        }
    }

    return sharpTurnCount;
}

function weightedTurnPenalty(path) {
    if (!Array.isArray(path) || path.length < 3) return 0;

    let penalty = 0;
    for (let index = 1; index < path.length - 1; index += 1) {
        const h1 = headingDegrees(path[index - 1], path[index]);
        const h2 = headingDegrees(path[index], path[index + 1]);
        let diff = Math.abs(h2 - h1);
        if (diff > 180) diff = 360 - diff;

        if (diff >= 150) penalty += 8;      // U턴에 가까운 역방향
        else if (diff >= 90) penalty += 3;  // 급회전
        else if (diff >= 55) penalty += 1;  // 경미한 방향 전환
    }

    return penalty;
}

function repeatRatio(path) {
    if (!Array.isArray(path) || path.length < 2) return 0;

    const sampled = [];
    const step = Math.max(1, Math.floor(path.length / 120));
    for (let index = 0; index < path.length; index += step) {
        sampled.push(path[index]);
    }

    const buckets = new Set(sampled.map((point) => `${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`));

    return 1 - buckets.size / sampled.length;
}

function evaluateRecommendation({ totalDistanceMeters, routePath, targetDistanceMeters, routeSource }) {
    const distanceGapRatio = Math.abs(totalDistanceMeters - targetDistanceMeters) / targetDistanceMeters;
    const sharpTurnCount = countSharpTurns(routePath);
    const turnPenalty = weightedTurnPenalty(routePath);
    const overlapRatio = repeatRatio(routePath);

    // 비선형 거리 점수: 오차가 커질수록 급격히 감소 (10% 오차 → 0.74, 현재 0.90)
    const distanceScore = Math.exp(-3 * distanceGapRatio);
    // 가중 급회전 점수: U턴(8점), 급회전(3점), 경미한 전환(1점) - 최대 60점 기준 정규화
    const turnScore = Math.max(0, 1 - turnPenalty / 60);
    const overlapScore = Math.max(0, 1 - overlapRatio * 1.4);
    // 가중치: 거리 정확도 50% / 회전 품질 30% / 중복 구간 20%
    const baseScore = Math.round((distanceScore * 0.5 + turnScore * 0.3 + overlapScore * 0.2) * 100);

    // PARTIAL_FALLBACK: 일부 구간이 직선 추정이므로 신뢰도 감점
    const sourcePenalty = routeSource === 'PARTIAL_FALLBACK' ? 12 : 0;
    const totalScore = Math.max(0, baseScore - sourcePenalty);

    const reason = [];
    reason.push(`목표거리 오차 ${Math.round(distanceGapRatio * 100)}%`);
    const turnLabel = turnPenalty >= 40 ? '회전 복잡' : turnPenalty >= 15 ? '회전 보통' : '회전 양호';
    reason.push(`${turnLabel}(${sharpTurnCount}회)`);
    reason.push(`중복구간 ${Math.round(overlapRatio * 100)}%`);
    if (routeSource === 'PARTIAL_FALLBACK') reason.push('일부 구간 추정');

    return {
        score: totalScore,
        reason: reason.join(' · '),
    };
}

async function requestTmapPedestrianSegment(start, end) {
    return withRetry(async () => {
        const response = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', {
            method: 'POST',
            headers: {
                appKey: tmapApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                startX: String(start.lng),
                startY: String(start.lat),
                endX: String(end.lng),
                endY: String(end.lat),
                reqCoordType: 'WGS84GEO',
                resCoordType: 'WGS84GEO',
                startName: '출발',
                endName: '도착',
                searchOption: '0', //
            }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
            throw new Error(`TMAP 보행 경로 요청 실패: ${message}`);
        }

        const features = Array.isArray(payload?.features) ? payload.features : [];
        const routePath = parseRoutePath(features);
        const totalDistanceMeters = parseTotalDistance(features, routePath);

        if (routePath.length < 2) {
            throw new Error('TMAP 응답에 유효한 경로 좌표가 없습니다.');
        }

        return { totalDistanceMeters, routePath };
    });
}

async function getPedestrianSegment(start, end) {
    const key = segmentCacheKey(start, end);
    if (segmentCache.has(key)) {
        return segmentCache.get(key);
    }

    const segment = await requestTmapPedestrianSegment(start, end);
    segmentCache.set(key, segment);
    return segment;
}

async function calculateCourseMetrics(normalizedPoints) {
    if (normalizedPoints.length < 2) {
        return {
            pointCount: normalizedPoints.length,
            totalDistanceMeters: 0,
            totalDistanceKm: 0,
            segmentDistancesMeters: [],
            routePath: normalizedPoints,
            routePathSegments: [],
            routeSource: 'TMAP_PEDESTRIAN',
        };
    }

    let totalDistanceMeters = 0;
    const segmentDistancesMeters = [];
    const routePath = [];
    const routePathSegments = [];
    let tmapCount = 0;
    let fallbackCount = 0;
    const warnings = [];

    for (let index = 0; index < normalizedPoints.length - 1; index += 1) {
        const start = normalizedPoints[index];
        const end = normalizedPoints[index + 1];

        let segment;
        try {
            segment = await getPedestrianSegment(start, end);
            tmapCount += 1;
        } catch (error) {
            fallbackCount += 1;
            warnings.push(`구간 ${index + 1}: ${error.message}`);
            segment = {
                totalDistanceMeters: Math.round(distanceInMeters(start, end)),
                routePath: [start, end],
            };
        }

        totalDistanceMeters += segment.totalDistanceMeters;
        segmentDistancesMeters.push(Math.round(segment.totalDistanceMeters));

        const segmentPath = dedupePath(segment.routePath);
        routePathSegments.push(segmentPath.length >= 2 ? segmentPath : [start, end]);

        if (routePath.length === 0) {
            routePath.push(...segment.routePath);
        } else {
            routePath.push(...segment.routePath.slice(1));
        }
    }

    const totalSegments = normalizedPoints.length - 1;
    const routeSource = fallbackCount === 0 ? 'TMAP_PEDESTRIAN' : fallbackCount < totalSegments ? 'PARTIAL_FALLBACK' : 'HAVERSINE_FALLBACK';

    return {
        pointCount: normalizedPoints.length,
        totalDistanceMeters,
        totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
        segmentDistancesMeters,
        routePath: dedupePath(routePath),
        routePathSegments,
        routeSource,
        ...(warnings.length > 0 && { warning: warnings.join(' | ') }),
    };
}

// 상태 확인 API
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'running-course-back',
        tmapConfigured: Boolean(tmapApiKey),
    });
});

app.post('/api/course/metrics', async (req, res) => {
    const points = req.body?.points;

    if (!Array.isArray(points)) {
        return res.status(400).json({ message: 'points 배열이 필요합니다.' });
    }

    if (points.length > 30) {
        return res.status(400).json({ message: 'points는 최대 30개까지 허용됩니다.' });
    }

    if (!points.every(isValidPoint)) {
        return res.status(400).json({ message: '각 포인트는 숫자 lat/lng 값을 가져야 합니다.' });
    }

    if (!tmapApiKey) {
        return res.status(500).json({
            message: 'TMAP_API_KEY가 설정되지 않았습니다. back/.env에 키를 추가하세요.',
        });
    }

    const normalizedPoints = points.map(normalizePoint);

    const result = await calculateCourseMetrics(normalizedPoints);
    return res.json(result);
});

app.post('/api/course/recommendations', async (req, res) => {
    const startPoint = req.body?.startPoint;
    const targetDistanceKm = Number(req.body?.targetDistanceKm ?? 5);
    const count = Math.min(5, Math.max(1, Number(req.body?.count ?? 3)));

    if (!isValidPoint(startPoint)) {
        return res.status(400).json({ message: 'startPoint는 숫자 lat/lng 값을 가져야 합니다.' });
    }

    if (!Number.isFinite(targetDistanceKm) || targetDistanceKm < 2 || targetDistanceKm > 30) {
        return res.status(400).json({ message: 'targetDistanceKm는 2~30 사이여야 합니다.' });
    }

    const start = normalizePoint(startPoint);
    const targetDistanceMeters = targetDistanceKm * 1000;
    const candidates = buildRecommendationCandidates(start, targetDistanceMeters);

    const evaluations = [];
    for (const candidate of candidates) {
        const metrics = await calculateCourseMetrics(candidate.points);

        // 전 구간이 직선 추정인 경우 신뢰도가 없으므로 제외
        if (metrics.routeSource === 'HAVERSINE_FALLBACK') {
            continue;
        }

        const evaluated = evaluateRecommendation({
            totalDistanceMeters: metrics.totalDistanceMeters,
            routePath: metrics.routePath,
            targetDistanceMeters,
            routeSource: metrics.routeSource,
        });

        evaluations.push({
            id: candidate.id,
            title: candidate.title,
            points: candidate.points,
            routePath: metrics.routePath,
            routePathSegments: metrics.routePathSegments,
            totalDistanceMeters: metrics.totalDistanceMeters,
            totalDistanceKm: Number((metrics.totalDistanceMeters / 1000).toFixed(2)),
            segmentDistancesMeters: metrics.segmentDistancesMeters,
            routeSource: metrics.routeSource,
            warning: metrics.warning || '',
            score: evaluated.score,
            reason: evaluated.reason,
        });
    }

    evaluations.sort((a, b) => b.score - a.score);

    return res.json({
        startPoint: start,
        targetDistanceKm,
        recommendations: evaluations.slice(0, count),
    });
});

app.listen(port, () => {
    console.log(`[running-course-back] listening on http://localhost:${port}`);
});
