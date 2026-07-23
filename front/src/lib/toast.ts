import { useSyncExternalStore } from 'react';

/**
 * 앱 전역 단일 토스트 스토어.
 * 기존 Vue `useToast` 싱글턴을 React 외부 스토어(useSyncExternalStore)로 재현한다.
 * `showToast` 는 컴포넌트 밖(액션 등)에서도 호출 가능하다.
 */
interface ToastState {
  visible: boolean;
  message: string;
}

let state: ToastState = { visible: false, message: '' };
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: ToastState): void {
  state = next;
  emit();
}

/** 토스트 메시지를 durationMs 동안 표시한다. */
export function showToast(message: string, durationMs = 2800): void {
  setState({ visible: true, message });
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    setState({ visible: false, message: '' });
    hideTimer = null;
  }, durationMs);
}

/** 토스트를 즉시 숨긴다. */
export function hideToast(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  setState({ visible: false, message: '' });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ToastState {
  return state;
}

/** 토스트 상태 구독 훅 (Toaster 컴포넌트 전용) */
export function useToast(): ToastState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
