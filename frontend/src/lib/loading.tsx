import { createContext, useContext, useEffect, useMemo, useState } from "react";

type LoadingContextValue = {
  activeCount: number;
  isLoading: boolean;
  pulseKey: number;
};

const LoadingContext = createContext<LoadingContextValue>({ activeCount: 0, isLoading: false, pulseKey: 0 });

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    return subscribeLoading((count) => {
      setActiveCount(count);
      if (count > 0) setPulseKey((k) => k + 1);
    });
  }, []);

  const value = useMemo(
    () => ({ activeCount, isLoading: activeCount > 0, pulseKey }),
    [activeCount, pulseKey],
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  return useContext(LoadingContext);
}

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let pendingRequests = 0;

function notify() {
  listeners.forEach((l) => l(pendingRequests));
}

export function subscribeLoading(listener: Listener) {
  listeners.add(listener);
  listener(pendingRequests);
  return () => {
    listeners.delete(listener);
  };
}

export function beginLoading() {
  pendingRequests += 1;
  notify();
}

export function endLoading() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notify();
}

export async function withLoading<T>(work: () => Promise<T>): Promise<T> {
  beginLoading();
  try {
    return await work();
  } finally {
    endLoading();
  }
}
