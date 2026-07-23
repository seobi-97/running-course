import { Footprints } from 'lucide-react';
import { NaverMapView } from '@/components/map/NaverMapView';
import { CoursePanel } from '@/components/course/CoursePanel';

export function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* 상단 바 */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-primary px-4 text-primary-foreground shadow">
        <Footprints className="size-6" />
        <h1 className="text-lg font-bold">Running Course Planner</h1>
        <span className="ml-auto hidden text-xs text-primary-foreground/80 sm:inline">
          네이버 지도 · Node.js API
        </span>
      </header>

      <main>
        <div className="mx-auto max-w-[1200px] px-4 py-6">
          <p className="mb-6 text-sm text-muted-foreground">
            네이버 지도와 Node.js API를 연결한 러닝 코스 계산기입니다.
          </p>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
            {/* 지도: lg 이상에서 상단 바 아래 sticky 고정 */}
            <div className="lg:sticky lg:top-[calc(3.5rem+1rem)] lg:h-[calc(100dvh-3.5rem-2rem)]">
              <NaverMapView />
            </div>
            {/* 패널: 페이지와 함께 스크롤 */}
            <div>
              <CoursePanel />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
