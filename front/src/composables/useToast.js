import { ref } from 'vue';

const toastVisible = ref(false);
const toastMessage = ref('');
let hideTimer;

/**
 * @param {string} message
 * @param {number} [durationMs=2800]
 */
export function showToast(message, durationMs = 2800) {
    toastMessage.value = message;
    toastVisible.value = true;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        toastVisible.value = false;
        hideTimer = undefined;
    }, durationMs);
}

export function useToast() {
    return { toastVisible, toastMessage };
}
