<script setup>
import { computed } from 'vue'
import { useCoursePath } from '../../composables/useCoursePath'

const {
  points,
  totalDistanceKm,
  segmentDistancesMeters,
  isSyncing,
  syncError,
  syncWarning,
  recommendationTargetKm,
  recommendations,
  recommendationError,
  isLoadingRecommendations,
  loadRecommendations,
  applyRecommendation,
  removeLastPoint,
  clearPoints,
} = useCoursePath()

const pointCountText = computed(() => `${points.value.length}개`)
const segmentDistanceItems = computed(() =>
  segmentDistancesMeters.value.map((distance, index) => ({
    id: `${index + 1}-${index + 2}`,
    label: `${index + 1} -> ${index + 2}`,
    text: distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(2)}km`,
  })),
)
</script>

<template>
  <aside class="panel-card">
    <h2>코스 정보</h2>
    <ul class="panel-list">
      <li>
        <span>선택 지점</span>
        <strong>{{ pointCountText }}</strong>
      </li>
      <li>
        <span>총 거리</span>
        <strong>{{ totalDistanceKm }} km</strong>
      </li>
      <li>
        <span>API 연동</span>
        <strong>{{ isSyncing ? '계산 중' : '연결됨' }}</strong>
      </li>
    </ul>
    <div class="panel-actions">
      <button type="button" @click="removeLastPoint">마지막 지점 삭제</button>
      <button type="button" @click="clearPoints">전체 초기화</button>
    </div>
    <div v-if="segmentDistanceItems.length" class="segment-box">
      <h3>구간 거리(최대 30개)</h3>
      <ul>
        <li v-for="segment in segmentDistanceItems" :key="segment.id">
          <span>{{ segment.label }}</span>
          <strong>{{ segment.text }}</strong>
        </li>
      </ul>
    </div>
    <div class="recommendation-box">
      <label class="recommendation-label">
        목표 거리(km)
        <input v-model.number="recommendationTargetKm" type="number" min="2" max="30" step="0.5" />
      </label>
      <button type="button" :disabled="isLoadingRecommendations" @click="loadRecommendations">
        {{ isLoadingRecommendations ? '추천 코스 계산 중...' : '러닝 코스 추천 받기' }}
      </button>
      <p v-if="recommendationError" class="panel-error">{{ recommendationError }}</p>
      <ul v-if="recommendations.length" class="recommendation-list">
        <li v-for="course in recommendations" :key="course.id">
          <div>
            <strong>{{ course.title }}</strong>
            <p>{{ course.totalDistanceKm }}km · 점수 {{ course.score }}</p>
            <p>{{ course.reason }}</p>
          </div>
          <button type="button" @click="applyRecommendation(course)">적용</button>
        </li>
      </ul>
    </div>
    <p class="panel-help">
      시작 지점을 클릭한 뒤 추천을 누르면 규칙 기반으로 러닝 코스 3개를 제안합니다.
    </p>
    <p v-if="syncWarning" class="panel-warning">{{ syncWarning }}</p>
    <p v-if="syncError" class="panel-error">{{ syncError }}</p>
  </aside>
</template>

<style scoped>
.panel-card {
  height: fit-content;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.panel-list {
  list-style: none;
  margin: 14px 0;
  padding: 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.panel-list li {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.panel-help {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

.segment-box {
  margin-top: 14px;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.segment-box h3 {
  margin: 0 0 8px;
  font-size: 14px;
}

.segment-box ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.segment-box li {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #334155;
}

.recommendation-box {
  margin-top: 14px;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
  display: grid;
  gap: 8px;
}

.recommendation-label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: #334155;
}

.recommendation-label input {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 7px 10px;
  font: inherit;
}

.recommendation-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.recommendation-list li {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  display: grid;
  gap: 8px;
}

.recommendation-list p {
  margin: 4px 0 0;
  color: #475569;
  font-size: 12px;
}

.panel-error {
  margin-top: 8px;
  font-size: 13px;
  color: #b91c1c;
}

.panel-warning {
  margin-top: 8px;
  font-size: 13px;
  color: #92400e;
}
</style>
