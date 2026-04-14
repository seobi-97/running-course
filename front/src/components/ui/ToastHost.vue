<script setup>
import { useToast } from '../../composables/useToast';

const { toastVisible, toastMessage } = useToast();
</script>

<template>
    <v-snackbar
        v-model="toastVisible"
        location="bottom"
        :timeout="-1"
        color="grey-darken-4"
        rounded="pill"
        multi-line
        max-width="420"
    >
        <div class="text-center">{{ toastMessage }}</div>
    </v-snackbar>
</template>
