import { ref } from 'vue';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  duration: number;
}

const messages = ref<ToastMessage[]>([]);
let idCounter = 0;
const isEnabled = ref(true); // 默认开启提示

function showToast(msg: string, msgType: ToastType = 'info', customDuration = 3000) {
  if (!isEnabled.value) return; // 如果关闭则不显示

  const toast = {
    id: idCounter++,
    text: msg,
    type: msgType,
    duration: customDuration,
  };
  messages.value.push(toast);

  setTimeout(() => {
    messages.value = messages.value.filter(m => m.id !== toast.id);
  }, customDuration);
}

function hideToast(id: number) {
  messages.value = messages.value.filter(m => m.id !== id);
}

function toggleToast(enabled: boolean) {
  isEnabled.value = enabled;
}

export function useToast() {
  return {
    messages,
    isEnabled,
    showToast,
    hideToast,
    toggleToast,
  };
}