<script setup>
import CoursePanel from './components/course/CoursePanel.vue'
import NaverMapView from './components/map/NaverMapView.vue'
import ToastHost from './components/ui/ToastHost.vue'
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable" flat>
      <template #prepend>
        <v-icon icon="mdi-run" size="large" class="ml-2" />
      </template>
      <v-app-bar-title class="font-weight-bold">Running Course Planner</v-app-bar-title>
      <v-spacer />
      <span class="text-caption text-white text-medium-emphasis d-none d-sm-inline pr-3">
        네이버 지도 · Node.js API
      </span>
    </v-app-bar>

    <v-main class="bg-background">
      <v-container class="py-6" max-width="1200">
        <p class="text-body-2 text-medium-emphasis mb-6">
          네이버 지도와 Node.js API를 연결한 러닝 코스 계산기입니다.
        </p>
        <div class="course-grid">
          <div class="map-section">
            <NaverMapView />
          </div>
          <div class="panel-section">
            <CoursePanel />
          </div>
        </div>
      </v-container>
    </v-main>

    <ToastHost />
  </v-app>
</template>

<style scoped>
.course-grid {
  display: grid;
  gap: 24px;
}

@media (min-width: 1280px) {
  .course-grid {
    grid-template-columns: 2fr 1fr;
    align-items: start; /* sticky가 동작하려면 stretch가 아니어야 함 */
  }

  /* 지도 영역을 헤더 바로 아래에 고정 — 패널은 페이지와 함께 스크롤 */
  .map-section {
    position: sticky;
    top: calc(var(--v-layout-top) + 16px);
    height: calc(100dvh - var(--v-layout-top) - 32px);
  }

  .map-section :deep(.v-card) {
    height: 100%;
  }
}
</style>
