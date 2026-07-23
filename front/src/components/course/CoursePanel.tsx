import { useMemo } from 'react';
import { Check, Lightbulb, MapPinned, Target, Trash2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useCourse } from '@/context/CourseContext';

/** 미터 → 사람이 읽기 좋은 거리 문자열 */
function formatSegmentDistanceMeters(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export function CoursePanel() {
  const {
    points,
    totalDistanceKm,
    segmentDistancesMeters,
    highlightedSegmentIndex,
    isSyncing,
    syncError,
    syncWarning,
    recommendationTargetKm,
    recommendations,
    recommendationError,
    isLoadingRecommendations,
    setRecommendationTargetKm,
    loadRecommendations,
    applyRecommendation,
    removeLastPoint,
    clearPoints,
    toggleSegmentHighlight,
  } = useCourse();

  const segmentDistanceItems = useMemo(
    () =>
      segmentDistancesMeters.map((distance, index) => ({
        id: `${index + 1}-${index + 2}`,
        label: `${index + 1} → ${index + 2}`,
        text: formatSegmentDistanceMeters(distance),
        segmentIndex: index,
      })),
    [segmentDistancesMeters]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="text-primary" />
          코스 정보
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 요약 정보 */}
        <dl className="divide-y rounded-lg border">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">선택 지점</dt>
            <dd className="text-sm font-semibold">{points.length}개</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">총 거리</dt>
            <dd className="text-sm font-semibold">{totalDistanceKm} km</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-sm text-muted-foreground">API 연동</dt>
            <dd>
              {isSyncing ? (
                <Badge variant="warning">계산 중</Badge>
              ) : (
                <Badge variant="success">연결됨</Badge>
              )}
            </dd>
          </div>
        </dl>

        {/* 지점 제어 버튼 */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={removeLastPoint} disabled={points.length === 0}>
            <Undo2 />
            마지막 지점 삭제
          </Button>
          <Button variant="outline" onClick={clearPoints} disabled={points.length === 0}>
            <Trash2 />
            전체 초기화
          </Button>
        </div>

        {/* 구간 거리 목록 */}
        {segmentDistanceItems.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">구간 거리 (최대 30개)</h3>
            <ul className="space-y-1">
              {segmentDistanceItems.map((item) => {
                const active = highlightedSegmentIndex === item.segmentIndex;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSegmentHighlight(item.segmentIndex)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md border border-transparent px-3 py-2 text-sm transition-colors hover:bg-muted',
                        active && 'border-primary/35 bg-primary/10'
                      )}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* 추천 코스 */}
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-primary" />
            러닝 코스 추천
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">목표 거리 (km)</span>
            <Input
              type="number"
              min={2}
              max={30}
              step={0.5}
              value={recommendationTargetKm}
              onChange={(event) => setRecommendationTargetKm(Number(event.target.value))}
            />
          </label>

          <Button
            className="w-full"
            onClick={loadRecommendations}
            loading={isLoadingRecommendations}
          >
            {!isLoadingRecommendations ? <Lightbulb /> : null}
            {isLoadingRecommendations ? '추천 코스 계산 중...' : '러닝 코스 추천 받기'}
          </Button>

          {recommendationError ? (
            <Alert variant="destructive">{recommendationError}</Alert>
          ) : null}

          {recommendations.length > 0 ? (
            <ul className="space-y-3">
              {recommendations.map((course) => (
                <li key={course.id}>
                  <Card className="border">
                    <CardContent className="space-y-2 p-4">
                      <div className="text-base font-bold">{course.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {course.totalDistanceKm}km · 점수 {course.score}
                      </div>
                      <p className="text-sm">{course.reason}</p>
                      <Button className="w-full" onClick={() => applyRecommendation(course)}>
                        <Check />이 코스 적용
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Alert variant="info">
          시작 지점을 클릭한 뒤 추천을 누르면 규칙 기반으로 러닝 코스 3개를 제안합니다.
        </Alert>

        {syncWarning ? <Alert variant="warning">{syncWarning}</Alert> : null}
        {syncError ? <Alert variant="destructive">{syncError}</Alert> : null}
      </CardContent>
    </Card>
  );
}
