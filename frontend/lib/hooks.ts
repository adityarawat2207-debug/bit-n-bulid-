"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Result, Source } from "./api";
import { isScenario } from "./companies";
import type { ScenarioId } from "./types";

/** The active scenario lives in the URL (?scenario=) so demo links are shareable. */
export function useScenario(): [ScenarioId, (s: ScenarioId) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // /incidents/<scenario> carries it in the path instead
  const raw = pathname.startsWith("/incidents/") ? pathname.split("/")[2] : params.get("scenario");
  const scenario: ScenarioId = isScenario(raw) ? raw : "baseline";
  const set = useCallback(
    (s: ScenarioId) => router.replace(`${pathname}?scenario=${s}`, { scroll: false }),
    [router, pathname],
  );
  return [scenario, set];
}

export interface AsyncState<T> {
  data: T | null;
  source: Source | null;
  error: string | null;
  loading: boolean;
}

/** Run an API call whenever `key` changes; keeps the previous data while reloading. */
export function useApi<T>(fn: () => Promise<Result<T>>, key: string): AsyncState<T> {
  const [state, setState] = useState<{ key: string | null; data: T | null; source: Source | null; error: string | null }>(
    { key: null, data: null, source: null, error: null },
  );
  useEffect(() => {
    let live = true;
    fn()
      .then((r) => live && setState({ key, data: r.data, source: r.source, error: null }))
      .catch((e: Error) => live && setState((s) => ({ ...s, key, error: e.message })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return { data: state.data, source: state.source, error: current ? state.error : null, loading: !current };
}

/** A counter that ticks every `ms` while `on`, for polling live scenarios. */
export function useTick(on: boolean, ms = 3000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [on, ms]);
  return on ? n : 0;
}
