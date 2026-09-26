"""Live telemetry from a running ShopX storefront (the demo store).

The store reports every request it serves: which service handled it, the
deployed version, and how many database queries it really ran. CloudPulse turns
the measured queries-per-request into the `search-service -> database` ratio
and replays ShopX's production traffic volume through the same company model,
so the engine analyses real behaviour at production scale.

Locally the events are kept in memory. A serverless deployment runs several
instances that share no memory, so when SUPABASE_URL and SUPABASE_KEY are set
the events go to a `live_events` table instead (see docs/live-telemetry.sql).
"""
import os
import time
from collections import deque
from datetime import datetime
from threading import Lock

import httpx

from simulator.company import DB, ONSET

SERVICE = "search-service"
WINDOW = 50  # the latest N requests define the current behaviour
# Baseline queries per search request in the ShopX model (shopx.py)
BASE_RATIO = 1.2


class MemoryStore:
    def __init__(self):
        self._lock = Lock()
        self._events: deque = deque(maxlen=WINDOW)
        self._versions: dict[str, str] = {}   # service -> version currently reporting
        self._deploys: list[dict] = []        # version changes, in order
        self._total = 0

    def record(self, service, version, db_queries, latency_ms):
        with self._lock:
            if service == SERVICE:
                self._events.append((time.time(), db_queries, latency_ms))
                self._total += 1
            if self._versions.get(service) != version:  # a new version reporting in = a deploy
                self._versions[service] = version
                self._deploys.append(dict(service=service, version=version, at=time.time()))

    def reset(self):
        with self._lock:
            self._events.clear()
            self._versions.clear()
            self._deploys.clear()
            self._total = 0

    def snapshot(self):
        """(latest events oldest first, total search requests, versions, deploys)"""
        with self._lock:
            return list(self._events), self._total, dict(self._versions), list(self._deploys)


class SupabaseStore:
    """The same store on a Postgres table, through Supabase's REST API."""

    def __init__(self, url, key):
        self._http = httpx.Client(base_url=url.rstrip("/") + "/rest/v1", timeout=8,
                                  headers={"apikey": key, "Authorization": f"Bearer {key}"})

    def _call(self, method, path, **kw):
        res = self._http.request(method, path, **kw)
        res.raise_for_status()
        return res

    def record(self, service, version, db_queries, latency_ms):
        self._call("POST", "/live_events", headers={"Prefer": "return=minimal"},
                   json=dict(service=service, version=version, db_queries=db_queries,
                             latency_ms=latency_ms))

    def reset(self):
        self._call("DELETE", "/live_events", params={"id": "gte.0"})

    def snapshot(self):
        res = self._call("GET", "/live_events", headers={"Prefer": "count=exact"},
                         params={"service": f"eq.{SERVICE}", "select": "at,db_queries,latency_ms",
                                 "order": "id.desc", "limit": WINDOW})
        total = int(res.headers.get("content-range", "*/0").split("/")[-1])
        events = [(_epoch(e["at"]), e["db_queries"], e["latency_ms"]) for e in reversed(res.json())]
        # one row per (service, version): when it first and last reported
        rows = self._call("GET", "/live_versions", params={"order": "first_at.asc"}).json()
        deploys = [dict(service=r["service"], version=r["version"], at=_epoch(r["first_at"])) for r in rows]
        versions = {r["service"]: r["version"] for r in sorted(rows, key=lambda r: r["last_at"])}
        return events, total, versions, deploys


def _epoch(ts: str) -> float:
    return datetime.fromisoformat(ts).timestamp()


def _make_store():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    return SupabaseStore(url, key) if url and key else MemoryStore()


_store = _make_store()


def record(service: str, version: str, db_queries: int, latency_ms: float, route: str = ""):
    _store.record(service, version, db_queries, latency_ms)


def reset():
    _store.reset()


def status():
    events, total, versions, deploys = _store.snapshot()
    n = len(events)
    qpr = sum(e[1] for e in events) / n if n else None
    return dict(requests_total=total, window=n, db_queries_per_request=qpr,
                baseline_queries_per_request=BASE_RATIO,
                latency_ms=sum(e[2] for e in events) / n if n else None,
                last_request_at=events[-1][0] if n else None,
                versions=versions, deploys=deploys,
                multiplier=_multiplier(qpr))


def _multiplier(qpr):
    # Healthy code at or below the modelled ratio changes nothing
    return max(1.0, qpr / BASE_RATIO) if qpr else 1.0


def spec():
    """The scenario spec for the current telemetry (same shape as shopx.py)."""
    s = status()
    m = s["multiplier"]
    if m < 1.05:
        return dict(deployments=[], effects=[]), s
    ours = [d for d in s["deploys"] if d["service"] == SERVICE][-1:]
    deps = [(d["service"], d["version"], ONSET - 1) for d in ours]
    return dict(deployments=deps, effects=[("ratio", (SERVICE, DB), round(m, 2))]), s
