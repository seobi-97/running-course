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
    const templates = [
        {
            title: '강변 순환형',
            bearings: [20, 120],
            ratios: [0.28, 0.24],
        },
        {
            title: '도심 완만 루프',
            bearings: [60, 180],
            ratios: [0.25, 0.22],
        },
        {
            title: '공원 우회 루프',
            bearings: [300, 40],
            ratios: [0.27, 0.23],
        },
        {
            title: '직선 왕복형',
            bearings: [90],
            ratios: [0.48],
        },
        {
            title: '대각 순환형',
            bearings: [330, 210],
            ratios: [0.26, 0.25],
        },
        {
            title: '반시계 루프',
            bearings: [250, 130],
            ratios: [0.28, 0.24],
        },
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

function evaluateRecommendation({ totalDistanceMeters, routePath, targetDistanceMeters }) {
    const distanceGapRatio = Math.abs(totalDistanceMeters - targetDistanceMeters) / targetDistanceMeters;
    const sharpTurnCount = countSharpTurns(routePath);
    const overlapRatio = repeatRatio(routePath);

    const distanceScore = Math.max(0, 1 - distanceGapRatio);
    const turnScore = Math.max(0, 1 - sharpTurnCount / 25);
    const overlapScore = Math.max(0, 1 - overlapRatio * 1.4);
    const totalScore = Math.round((distanceScore * 0.55 + turnScore * 0.25 + overlapScore * 0.2) * 100);

    const reason = [];
    reason.push(`목표거리 오차 ${Math.round(distanceGapRatio * 100)}%`);
    reason.push(`급회전 ${sharpTurnCount}회`);
    reason.push(`중복구간 ${Math.round(overlapRatio * 100)}%`);

    return {
        score: totalScore,
        reason: reason.join(' · '),
    };
}

async function requestTmapPedestrianSegment(start, end) {
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
            searchOption: '30',
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

    if (routePath.length === 0) {
        return {
            totalDistanceMeters: Math.round(distanceInMeters(start, end)),
            routePath: [start, end],
        };
    }

    return {
        totalDistanceMeters,
        routePath,
    };
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

    try {
        let totalDistanceMeters = 0;
        const segmentDistancesMeters = [];
        const routePath = [];
        const routePathSegments = [];

        for (let index = 0; index < normalizedPoints.length - 1; index += 1) {
            const start = normalizedPoints[index];
            const end = normalizedPoints[index + 1];
            const segment = await getPedestrianSegment(start, end);

            totalDistanceMeters += segment.totalDistanceMeters;
            segmentDistancesMeters.push(Math.round(segment.totalDistanceMeters));

            const segmentPath = dedupePath(segment.routePath);
            if (segmentPath.length < 2) {
                routePathSegments.push([start, end]);
            } else {
                routePathSegments.push(segmentPath);
            }

            if (routePath.length === 0) {
                routePath.push(...segment.routePath);
            } else {
                routePath.push(...segment.routePath.slice(1));
            }
        }

        return {
            pointCount: normalizedPoints.length,
            totalDistanceMeters,
            totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
            segmentDistancesMeters,
            routePath: dedupePath(routePath),
            routePathSegments,
            routeSource: 'TMAP_PEDESTRIAN',
        };
    } catch (error) {
        const fallback = buildStraightLineMetrics(normalizedPoints);
        return {
            pointCount: normalizedPoints.length,
            totalDistanceMeters: fallback.totalDistanceMeters,
            totalDistanceKm: Number((fallback.totalDistanceMeters / 1000).toFixed(2)),
            segmentDistancesMeters: fallback.segmentDistancesMeters,
            routePath: fallback.routePath,
            routePathSegments: fallback.routePathSegments,
            routeSource: 'HAVERSINE_FALLBACK',
            warning: error.message || 'TMAP 보행 경로를 계산하지 못해 직선 거리로 대체했습니다.',
        };
    }
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
        if (metrics.routeSource === 'HAVERSINE_FALLBACK') {
            continue;
        }

        const evaluated = evaluateRecommendation({
            totalDistanceMeters: metrics.totalDistanceMeters,
            routePath: metrics.routePath,
            targetDistanceMeters,
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
