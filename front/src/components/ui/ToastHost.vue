<script setup>
import { useToast } from '../../composables/useToast';

const { toastVisible, toastMessage } = useToast();
</script>

<template>
    <Teleport to="body">
        <div class="toast-anchor" aria-live="polite">
            <Transition name="toast">
                <div v-if="toastVisible" class="toast-panel" role="status">{{ toastMessage }}</div>
            </Transition>
        </div>
    </Teleport>
</template>

<style scoped>
.toast-anchor {
    position: fixed;
    left: 50%;
    bottom: 28px;
    transform: translateX(-50%);
    z-index: 9999;
    pointer-events: none;
    max-width: min(420px, calc(100vw - 32px));
}

.toast-panel {
    pointer-events: auto;
    padding: 12px 18px;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.92);
    color: #f8fafc;
    font-size: 14px;
    line-height: 1.45;
    text-align: center;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.toast-enter-active,
.toast-leave-active {
    transition:
        opacity 0.22s ease,
        transform 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
    opacity: 0;
    transform: translateY(12px);
}

.toast-enter-to,
.toast-leave-from {
    opacity: 1;
    transform: translateY(0);
}
</style>
