import { useRegisterSW } from 'virtual:pwa-register/react';

export interface AppUpdate {
  needsUpdate: boolean;
  applyUpdate: () => void;
}

export function useAppUpdate(): AppUpdate {
  const {
    needRefresh: [needsUpdate],
    updateServiceWorker
  } = useRegisterSW();

  return { needsUpdate, applyUpdate: () => void updateServiceWorker() };
}