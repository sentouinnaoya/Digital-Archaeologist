'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { readStoredAuth, writeStoredAuth } from '@/lib/auth-storage';
import { store } from '@/store';
import { hydrate } from '@/store/slices/authSlice';

export function Providers({ children }: { children: ReactNode }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    store.dispatch(hydrate(readStoredAuth()));

    const unsubscribe = store.subscribe(() => {
      const { user, accessToken } = store.getState().auth;
      writeStoredAuth(user && accessToken ? { user, accessToken } : null);
    });

    return unsubscribe;
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
