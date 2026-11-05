import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// Loads a GET endpoint. Pass null as path to skip loading.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api(path);
      if (id === reqId.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  const setData = useCallback((fn) => {
    setState((s) => ({ ...s, data: typeof fn === "function" ? fn(s.data) : fn }));
  }, []);

  return { ...state, reload: load, setData };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
