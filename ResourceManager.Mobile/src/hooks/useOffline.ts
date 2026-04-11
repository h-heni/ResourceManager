import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  OFFLINE_QUEUE: '@offline_queue',
  PENDING_SCANS: '@pending_scans',
};

export interface QueuedAction {
  id: string;
  type: 'upload_scan' | 'send_email' | 'api_request';
  data: any;
  timestamp: string;
  retryCount: number;
}

export function useOffline() {
  const [isOffline, setIsOffline] = useState(false);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [pendingScans, setPendingScans] = useState<any[]>([]);

  useEffect(() => {
    // Load offline data
    loadOfflineData();

    // Listen to network state
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected || !state.isInternetReachable);

      // When coming back online, process queue
      if (state.isConnected && state.isInternetReachable) {
        processQueue();
      }
    });

    return unsubscribe;
  }, []);

  const loadOfflineData = async () => {
    try {
      const queueStr = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      const scansStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SCANS);

      if (queueStr) setQueue(JSON.parse(queueStr));
      if (scansStr) setPendingScans(JSON.parse(scansStr));
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  };

  const addToQueue = async (action: QueuedAction) => {
    const newQueue = [...queue, action];
    setQueue(newQueue);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(newQueue));
  };

  const removeFromQueue = async (id: string) => {
    const newQueue = queue.filter(item => item.id !== id);
    setQueue(newQueue);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(newQueue));
  };

  const addPendingScan = async (scan: any) => {
    const newScans = [...pendingScans, scan];
    setPendingScans(newScans);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SCANS, JSON.stringify(newScans));
  };

  const removePendingScan = async (scanId: string) => {
    const newScans = pendingScans.filter(scan => scan.id !== scanId);
    setPendingScans(newScans);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SCANS, JSON.stringify(newScans));
  };

  const processQueue = async () => {
    for (const action of [...queue]) {
      try {
        switch (action.type) {
          case 'upload_scan':
            // Re-attempt scan upload
            console.log('Processing queued scan:', action.id);
            break;
          case 'send_email':
            // Re-attempt email sending
            console.log('Processing queued email:', action.id);
            break;
          case 'api_request':
            // Retry failed API request
            console.log('Processing queued request:', action.id);
            break;
        }

        // Successfully processed - remove from queue
        await removeFromQueue(action.id);
      } catch (error) {
        // Increment retry count
        action.retryCount = (action.retryCount || 0) + 1;

        // If max retries exceeded, give up
        if (action.retryCount >= 3) {
          await removeFromQueue(action.id);
        } else {
          // Update in storage
          const index = queue.findIndex(item => item.id === action.id);
          if (index !== -1) {
            const newQueue = [...queue];
            newQueue[index] = action;
            setQueue(newQueue);
            await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(newQueue));
          }
        }
      }
    }
  };

  const clearQueue = async () => {
    setQueue([]);
    setPendingScans([]);
    await AsyncStorage.multiRemove([STORAGE_KEYS.OFFLINE_QUEUE, STORAGE_KEYS.PENDING_SCANS]);
  };

  return {
    isOffline,
    queue,
    pendingScans,
    addToQueue,
    removeFromQueue,
    addPendingScan,
    removePendingScan,
    processQueue,
    clearQueue,
  };
}
