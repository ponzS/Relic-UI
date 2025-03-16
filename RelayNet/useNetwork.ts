import { ref, onMounted, onUnmounted } from 'vue';
import Gun, { IGunInstance } from 'gun';

export function useNetwork(gunInstance: IGunInstance<any>) {
  const isOnline = ref(navigator.onLine);
  const peersConnected = ref(false);
  const checkInterval = 3000; // 每 3 秒检查一次

  // 检查 Gun.js 对等节点，反复尝试直到成功
  async function checkPeers(): Promise<boolean> {
    const maxAttempts = Infinity; // 无限制尝试，直到成功
    let attempt = 0;
    const retryDelay = 1000; // 每次尝试间隔 1 秒

    while (attempt < maxAttempts) {
      attempt++;
    //  console.log(`Checking peers, attempt ${attempt}...`);
      const result = await new Promise<boolean>((resolve) => {
        let alive = false;
        const off = gunInstance.get('~public').once((data) => {
       //  console.log('Peer response:', data);
          alive = true;
          off.off();
          resolve(true);
        });
        setTimeout(() => {
          if (!alive) {
          //  console.log('Peers timed out after 10s');
            resolve(false);
          }
        }, 10000); // 10 秒超时
      });

      if (result) {
        peersConnected.value = true;
        return true;
      } else {
      //  console.log(`Peers not reachable, retrying in ${retryDelay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return false; // 理论上不会到达这里，因为 maxAttempts 是 Infinity
  }

  async function updateNetworkStatus() {
    isOnline.value = navigator.onLine;
    peersConnected.value = await checkPeers();
  }

  function handleOnline() {
    updateNetworkStatus();
  }

  function handleOffline() {
    isOnline.value = false;
    peersConnected.value = false;
  }

  let intervalId: number | null = null;
  function startChecking() {
    updateNetworkStatus();
    intervalId = window.setInterval(updateNetworkStatus, checkInterval);
  }

  function stopChecking() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    startChecking();
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopChecking();
  });

  return {
    isOnline,
    peersConnected,
    updateNetworkStatus,
    checkPeers,
  };
}