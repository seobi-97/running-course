import { useToast } from '@/lib/toast';

/** 화면 하단 중앙에 단일 토스트를 표시한다. (기존 ToastHost 대응) */
export function Toaster() {
  const { visible, message } = useToast();

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="animate-toast-in pointer-events-auto max-w-[420px] rounded-full bg-slate-900 px-5 py-3 text-center text-sm font-medium text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
