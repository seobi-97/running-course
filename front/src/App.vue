<script setup>
import CoursePanel from './components/course/CoursePanel.vue'
import NaverMapView from './components/map/NaverMapView.vue'
import ToastHost from './components/ui/ToastHost.vue'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Running Course Planner</h1>
      <p>네이버 지도와 Node.js API를 연결한 러닝 코스 계산기입니다.</p>
    </header>
    <main class="app-main">
      <NaverMapView />
      <CoursePanel />
    </main>
    <ToastHost />
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px 32px;
}

.app-header h1 {
  margin: 0;
  font-size: 28px;
}

.app-header p {
  margin-top: 8px;
  color: #5f6368;
}

.app-main {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  margin-top: 20px;
}

@media (max-width: 900px) {
  .app-main {
    grid-template-columns: 1fr;
  }
}
</style>
