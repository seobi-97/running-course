<script setup>
import { computed } from 'vue';
import { useCoursePath } from '../../composables/useCoursePath';

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
    loadRecommendations,
    applyRecommendation,
    removeLastPoint,
    clearPoints,
    toggleSegmentHighlight,
} = useCoursePath();

/**
 * @param {number} meters
 * @returns {string}
 */
function formatSegmentDistanceMeters(meters) {
    if (meters < 1000) {
        return `${meters}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
}

const pointCountText = computed(() => `${points.value.length}개`);
const segmentDistanceItems = computed(() =>
    segmentDistancesMeters.value.map((distance, index) => ({
        id: `${index + 1}-${index + 2}`,
        label: `${index + 1} → ${index + 2}`,
        text: formatSegmentDistanceMeters(distance),
        segmentIndex: index,
    })),
);
</script>

<template>
    <v-card class="sticky-panel">
        <v-card-title class="d-flex align-center gap-2 pb-2">
            <v-icon color="primary" icon="mdi-map-marker-path" />
            코스 정보
        </v-card-title>

        <v-card-text class="pt-0">
            <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item class="px-0">
                    <v-list-item-title>선택 지점</v-list-item-title>
                    <template #append>
                        <span class="text-body-1 font-weight-semibold">{{ pointCountText }}</span>
                    </template>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item class="px-0">
                    <v-list-item-title>총 거리</v-list-item-title>
                    <template #append>
                        <span class="text-body-1 font-weight-semibold text-primary">{{ totalDistanceKm }} km</span>
                    </template>
                </v-list-item>
                <v-divider class="my-1" />
                <v-list-item class="px-0">
                    <v-list-item-title>API 연동</v-list-item-title>
                    <template #append>
                        <v-chip :color="isSyncing ? 'warning' : 'success'" size="small" variant="flat" class="font-weight-medium">
                            {{ isSyncing ? '계산 중' : '연결됨' }}
                        </v-chip>
                    </template>
                </v-list-item>
            </v-list>

            <div class="d-flex flex-wrap gap-2 mt-3">
                <v-btn color="secondary" variant="tonal" prepend-icon="mdi-undo" @click="removeLastPoint"> 마지막 지점 삭제 </v-btn>
                <v-btn color="secondary" prepend-icon="mdi-delete-sweep" @click="clearPoints"> 전체 초기화 </v-btn>
            </div>

            <template v-if="segmentDistanceItems.length">
                <v-divider class="my-4" />
                <div class="text-subtitle-2 font-weight-bold mb-1">구간 거리 (최대 30개)</div>
                <p class="text-caption text-medium-emphasis mb-2">구간을 누르면 지도에서 해당 구간만 강조됩니다. 다시 누르면 해제됩니다.</p>
                <v-list density="compact" class="segment-list bg-transparent pa-0">
                    <v-list-item
                        v-for="segment in segmentDistanceItems"
                        :key="segment.id"
                        class="segment-list-item px-2 mb-1 rounded"
                        :active="highlightedSegmentIndex === segment.segmentIndex"
                        rounded="lg"
                        @click="toggleSegmentHighlight(segment.segmentIndex)"
                    >
                        <v-list-item-title class="text-body-2">{{ segment.label }}</v-list-item-title>
                        <template #append>
                            <span class="text-body-2 font-weight-bold">{{ segment.text }}</span>
                        </template>
                    </v-list-item>
                </v-list>
            </template>

            <v-divider class="my-4" />

            <div class="text-subtitle-2 font-weight-bold mb-3">러닝 코스 추천</div>
            <v-text-field v-model.number="recommendationTargetKm" label="목표 거리 (km)" type="number" min="2" max="30" step="0.5" prepend-inner-icon="mdi-target" />
            <v-btn block color="primary" size="large" class="mt-1" :loading="isLoadingRecommendations" prepend-icon="mdi-lightbulb-on-outline" @click="loadRecommendations">
                {{ isLoadingRecommendations ? '추천 코스 계산 중...' : '러닝 코스 추천 받기' }}
            </v-btn>

            <v-alert v-if="recommendationError" type="error" variant="tonal" density="compact" class="mt-3" rounded="lg">
                {{ recommendationError }}
            </v-alert>

            <v-list v-if="recommendations.length" class="bg-transparent pa-0 mt-3">
                <v-card v-for="course in recommendations" :key="course.id" variant="outlined" class="mb-3 recommendation-card">
                    <v-card-text>
                        <div class="text-subtitle-1 font-weight-bold">{{ course.title }}</div>
                        <div class="text-body-2 text-medium-emphasis mt-1">{{ course.totalDistanceKm }}km · 점수 {{ course.score }}</div>
                        <p class="text-body-2 mt-2 mb-3">{{ course.reason }}</p>
                        <v-btn color="primary" block prepend-icon="mdi-check" @click="applyRecommendation(course)"> 이 코스 적용 </v-btn>
                    </v-card-text>
                </v-card>
            </v-list>

            <v-alert type="info" variant="tonal" density="compact" class="mt-4" rounded="lg">
                시작 지점을 클릭한 뒤 추천을 누르면 규칙 기반으로 러닝 코스 3개를 제안합니다.
            </v-alert>

            <v-alert v-if="syncWarning" type="warning" variant="tonal" density="compact" class="mt-3" rounded="lg">
                {{ syncWarning }}
            </v-alert>
            <v-alert v-if="syncError" type="error" variant="tonal" density="compact" class="mt-3" rounded="lg">
                {{ syncError }}
            </v-alert>
        </v-card-text>
    </v-card>
</template>

<style scoped>
.sticky-panel {
    position: sticky;
    top: 88px;
}

.segment-list-item.v-list-item--active {
    background: rgba(var(--v-theme-primary), 0.12) !important;
    border: 1px solid rgba(var(--v-theme-primary), 0.35);
}

@media (max-width: 1279px) {
    .sticky-panel {
        position: static;
    }
}
</style>
