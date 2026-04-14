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
        <v-row>
          <v-col cols="12" lg="8">
            <NaverMapView />
          </v-col>
          <v-col cols="12" lg="4">
            <CoursePanel />
          </v-col>
        </v-row>
      </v-container>
    </v-main>

    <ToastHost />
  </v-app>
</template>
