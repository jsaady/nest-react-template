import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HTTPClient, useHttp } from './http.js';

export const useAsync = <T, A extends any[]> (cb: (...args: A) => Promise<T>, deps: any[]) => {
  const [state, setState] = useState({
    loading: false,
    result: null as T,
    error: null as any
  });

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const trigger = useCallback(async (...args: A) => {
    if (stateRef.current.loading) return;

    setState(s => ({
      ...s,
      loading: true
    }));

    try {
      const result = await cb(...args);

      setState(s => ({
        loading: false,
        result,
        error: null
      }));
    } catch (e) {
      setState(s => ({
        ...s,
        loading: false,
        error: e
      }));
    }
  }, [cb, ...deps]);

  return [trigger, state] as const;
};

type Pop<T, O extends any[] = []> = T extends [infer Head, ...infer Tail] ? Tail extends [any] ? [...O, Head] : Pop<Tail, [...O, Head]> : [];

type AsyncHTTPClient = {
  [x in keyof HTTPClient]: (...args: Pop<Parameters<HTTPClient[x]>>) => ReturnType<HTTPClient[x]>;
};

export const useAsyncHttp = <T, A extends any[]>(call: (http: AsyncHTTPClient, ...rest: A) => Promise<T>, deps: any[]) => {
  const httpClient = useHttp();
  const controller = useMemo(() => new AbortController(), []);
  const cancel = useCallback(() => controller.abort(), [controller]);

  const http = useMemo<AsyncHTTPClient>(() => ({
    get: (path: string) => httpClient.get(path, controller.signal),
    post: (path: string, body: any) => {
      return httpClient.post(path, body, controller.signal)
    }
  }), [httpClient, controller]);

  const asyncCb = useCallback((...args: A) => {
    return call(http, ...args);
  }, [http, call, ...deps]);

  const [trigger, state] = useAsync(asyncCb, []);

  const makeCall = useCallback((...args: A) => {
    trigger(...args);

    return cancel;
  }, []);

  return [makeCall, state, cancel] as const;
}
