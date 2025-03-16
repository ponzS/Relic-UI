import { ref, onMounted, onUnmounted, watch } from 'vue';
import Gun from 'gun';
import { useChatFlow } from '@/composables/TalkFlowCore';
import { useToast } from '@/composables/useToast';
import { useNetwork } from '@/composables/useNetwork';

export function useNetworkStatus() {
  const { 
    gun, 
    peersList, 
    enabledPeer, 
    prioritizePeer, 
    disablePeer, 
    checkEnabledPeer, 
    restartGun, 
    isLoggedIn, 
    currentUserPub 
  } = useChatFlow();
  const { showToast } = useToast();
  const { isOnline, peersConnected, updateNetworkStatus } = useNetwork(gun);

  const networkStatus = ref<'online' | 'offline'>('online');
  const peersStatus = ref<'connected' | 'disconnected'>('disconnected');
  const currentMode = ref<'direct' | 'relay'>('direct');
  const peerStatuses = ref<Record<string, 'connected' | 'disconnected' | 'checking'>>({});

  const connectionAttempt = ref<string | null>(null);
  let cancelConnection: (() => void) | null = null;

  // 新增：持久化 enabledPeer 的本地存储键
  const ENABLED_PEER_KEY = 'enabledPeer';

  // 新增：保存 enabledPeer 到 localStorage
  function saveEnabledPeer() {
    localStorage.setItem(ENABLED_PEER_KEY, enabledPeer.value);
   // console.log('Saved enabledPeer:', enabledPeer.value);
  }

  // 新增：加载 enabledPeer 从 localStorage
  function loadEnabledPeer() {
    const savedPeer = localStorage.getItem(ENABLED_PEER_KEY);
    if (savedPeer && peersList.value.includes(savedPeer)) {
      enabledPeer.value = savedPeer; // 更新 TalkFlowCore 的 enabledPeer
      gun.opt({ peers: [enabledPeer.value] }); // 同步到 Gun.js
   //   console.log('Loaded enabledPeer:', savedPeer);
    } else if (peersList.value.length > 0) {
      enabledPeer.value = peersList.value[0]; // 默认值
      saveEnabledPeer();
    }
  }

  async function updateStatus() {
    networkStatus.value = isOnline.value ? 'online' : 'offline';
    peersStatus.value = enabledPeer.value ? (await checkEnabledPeer() ? 'connected' : 'disconnected') : 'disconnected';
    currentMode.value = enabledPeer.value && peersStatus.value === 'connected' ? 'relay' : 'direct';
    await updatePeerStatuses();
  }

  async function checkPeerStatus(peer: string): Promise<'connected' | 'disconnected'> {
    return new Promise((resolve) => {
      const tempGun = Gun({ peers: [peer] });
      let connected = false;
      tempGun.on('hi', () => {
        connected = true;
        resolve('connected');
      });
      setTimeout(() => {
        if (!connected) resolve('disconnected');
      }, 5000);
    });
  }

  async function updatePeerStatuses() {
    peersList.value.forEach(async (peer) => {
      peerStatuses.value[peer] = 'checking';
      const status = await checkPeerStatus(peer);
      peerStatuses.value[peer] = status;
    });
  }

  async function enablePeer(peer: string) {
    if (cancelConnection) {
      cancelConnection();
      cancelConnection = null;
    }

    connectionAttempt.value = peer;
    prioritizePeer(peer);
    saveEnabledPeer(); 

    let connected = false;
    let cancelled = false;

    cancelConnection = () => {
      cancelled = true;
      showToast(`Cancel the connection ${peer} `, 'info');
    };

    while (!connected && !cancelled) {
      const status = await checkEnabledPeer();
      if (status) {
        connected = true;
        connectionAttempt.value = null;
        cancelConnection = null;
        showToast(`Successfully connected ${peer}`, 'success');
      } else if (!cancelled) {
        showToast(` ${peer} The connection failed, it is retrying...`, 'warning');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!cancelled) await updateStatus();
  }

  function addPeer(url: string) {
    if (!url) {
      showToast('Please enter the node URL', 'warning');
      return;
    }
    if (peersList.value.includes(url)) {
      showToast('This node already exists.', 'warning');
      return;
    }
    peersList.value.push(url);
    localStorage.setItem('peers', JSON.stringify(peersList.value)); 
    updatePeerStatuses();
    showToast(`Nodes have been added ${url}`, 'success');
  }

  function removePeer(peer: string) {
    if (enabledPeer.value === peer) {
      disablePeer(); 
    }
    peersList.value = peersList.value.filter(p => p !== peer);
    delete peerStatuses.value[peer];
    localStorage.setItem('peers', JSON.stringify(peersList.value)); 
    showToast(`Deleted node ${peer}`, 'success');
    updatePeerStatuses();
  }

  function loadPeers() {
    const saved = localStorage.getItem('peers');
    if (saved) {
      peersList.value = JSON.parse(saved);
    }
    loadEnabledPeer(); // 加载持久化的 enabledPeer
    updatePeerStatuses();
  }

  function handleOnline() {
    updateNetworkStatus();
    updateStatus();
    if (isLoggedIn.value && currentUserPub.value) {
      restartGun(); // 重启时保持 enabledPeer
    }
  }

  function handleOffline() {
    updateNetworkStatus();
    updateStatus();
  }

  onMounted(() => {
    loadPeers(); // 加载 peersList 和 enabledPeer
    updateStatus();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onUnmounted(() => {
    if (cancelConnection) {
      cancelConnection();
    }
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  watch(peersList, () => updatePeerStatuses());
  watch(enabledPeer, () => {
    updateStatus();
    saveEnabledPeer(); // 每次 enabledPeer 变化时保存
  });

  return {
    networkStatus,
    peersStatus,
    currentMode,
    peerStatuses,
    peersList,
    enabledPeer,
    addPeer,
    removePeer,
    enablePeer,
    disablePeer,
    updateStatus,
  };
}