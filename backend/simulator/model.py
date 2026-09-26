"""ShopX system model + data generator (PRD §9-10, §30-34).

One steady-state model is shared by the data generator (per hour, with noise)
and the trade-off simulator (what-if), so simulated fixes are consistent with
the data the engine analysed.
"""
from datetime import datetime, timedelta, timezone

import numpy as np

GATEWAY = "api-gateway"
# (source, target) -> base calls per inbound request of source
EDGES = {
    (GATEWAY, "auth-service"): None,     # gateway edges carry user demand
    (GATEWAY, "search-service"): None,
    (GATEWAY, "order-service"): None,
    (GATEWAY, "image-service"): None,
    ("search-service", "redis"): 2.0,
    ("search-service", "database"): 1.2,
    ("auth-service", "database"): 0.5,
    ("order-service", "database"): 3.0,
    ("order-service", "payment-service"): 0.3,
    ("image-service", "cdn"): 1.0,
    ("database", "analytics"): 0.02,
}
KIND = {
    GATEWAY: "ingress",
    "auth-service": "service", "search-service": "service",
    "order-service": "service", "image-service": "service",
    "payment-service": "service",
    "redis": "resource", "database": "resource", "cdn": "resource",
    "analytics": "resource",
}
TOPO = [GATEWAY, "auth-service", "search-service", "order-service",
        "image-service", "payment-service", "redis", "cdn", "database", "analytics"]
ENTRY = [t for (s, t) in EDGES if s == GATEWAY]
BASE_DEMAND = {"auth-service": 15000, "search-service": 42000,
               "order-service": 6000, "image-service": 20000}  # req/min
# DB work units per query, by caller (search queries are light lookups)
QUERY_WEIGHT = {"search-service": 0.2, "auth-service": 1.0, "order-service": 1.0}
DB_CAPACITY = 35580 / 0.42  # baseline DB CPU = 42%

# Simulated day 0 starts here; hour h of the data is START + h hours.
START = datetime(2026, 8, 27, tzinfo=timezone.utc)


def iso(hour):
    return (START + timedelta(hours=int(hour))).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_date(day):
    return (START + timedelta(days=int(day))).strftime("%Y-%m-%d")


def parents(n):
    return [s for (s, t) in EDGES if t == n]


def children(n):
    return [t for (s, t) in EDGES if s == n]


def steady_state(demand, ratios, db_capacity=DB_CAPACITY):
    """Return per-node inbound load, per-edge calls, DB utilisation,
    latency (ms), error rate (%) and cost ($/hour, by resource type)."""
    inbound = {n: 0.0 for n in TOPO}
    calls = {}
    inbound[GATEWAY] = sum(demand.values())
    for n in TOPO:
        for c in children(n):
            e = (n, c)
            calls[e] = demand[c] if n == GATEWAY else inbound[n] * ratios[e]
            inbound[c] += calls[e]
    work = sum(calls[(s, "database")] * QUERY_WEIGHT[s] for s in parents("database"))
    rho = work / db_capacity
    db_lat = 4.0 / (1 - min(rho, 0.97))
    reject = max(0.0, 1 - 1 / rho) if rho > 1 else 0.0
    db_err = 100 * reject + (0.5 * (rho - 0.85) / 0.15 if rho > 0.85 else 0.0)

    latency, error = {}, {}
    for s, base in [("search-service", 60), ("order-service", 90), ("auth-service", 25),
                    ("image-service", 40), ("payment-service", 150)]:
        q = ratios.get((s, "database"), 0.0)
        latency[s] = base + q * db_lat + ratios.get((s, "redis"), 0.0) * 0.5
        error[s] = 0.1 + (db_err if q else 0.0)

    cost = monthly_costs(inbound, calls, work, db_capacity)
    return dict(inbound=inbound, calls=calls, work=work, db_cpu=rho,
                db_latency=db_lat, latency=latency, error=error, cost=cost)


def base_ratios():
    return {e: r for e, r in EDGES.items() if r is not None}


# Baseline monthly budget, calibrated to PRD §16 (sums to $10,240).
# Each line = (fixed $/mo, variable $/mo at baseline load).
COMPUTE = {GATEWAY: (200, 300), "auth-service": (150, 200), "search-service": (300, 500),
           "order-service": (200, 250), "image-service": (150, 250),
           "payment-service": (70, 80), "analytics": (100, 150)}          # $2,900
DB_CAPACITY_COST, DB_IO_COST = 2000, 800                                 # $2,800
NETWORK_TOTAL = 1500                                                     # $1,500
REDIS = (400, 550)                                                       # $950
STORAGE = {"database": 1400, "analytics": 390}                           # $1,790
CDN = (100, 200)                                                         # $300
_BASE = None


def _wout(n, calls):
    return sum(calls[(n, c)] for c in children(n))


def monthly_costs(inbound, calls, work, db_capacity):
    """Cost in $/hour by node and resource type (monthly budget / 720)."""
    if _BASE is None:  # first call computes the baseline loads themselves
        return {n: {} for n in TOPO}
    b = _BASE
    wtot = sum(_wout(n, b["calls"]) for n in TOPO)
    c = {n: {} for n in TOPO}
    for n, (fix, var) in COMPUTE.items():
        c[n]["compute"] = fix + var * inbound[n] / b["inbound"][n]
    for n in TOPO:
        if _wout(n, b["calls"]):
            c[n]["network"] = NETWORK_TOTAL * _wout(n, calls) / wtot
    c["database"]["database"] = DB_CAPACITY_COST * db_capacity / DB_CAPACITY + DB_IO_COST * work / b["work"]
    c["redis"]["cache"] = REDIS[0] + REDIS[1] * inbound["redis"] / b["inbound"]["redis"]
    c["cdn"]["cdn"] = CDN[0] + CDN[1] * inbound["cdn"] / b["inbound"]["cdn"]
    for n, v in STORAGE.items():
        c[n]["storage"] = v
    return {n: {k: v / 720 for k, v in d.items()} for n, d in c.items()}


_BASE = steady_state(BASE_DEMAND, base_ratios())
COST_SCALE = 1.0

# --------------------------------------------------------------------------
# Scenarios. Onset = day 26, 10:00 (hour index 634). Each incident has a decoy.
# `expected` is the answer key for tests only; the engine never reads it.
ONSET = 26 * 24 + 10
SCENARIOS = {
    "baseline": dict(
        name="Healthy baseline",
        description="Normal ShopX traffic with no incident",
        expected=None, deployments=[], effects=[],
    ),
    "search_query_explosion": dict(
        name="Search Query Explosion",
        description="Search v2.0 deploy multiplies database queries per request",
        expected="search-service",
        deployments=[("search-service", "v2.0", ONSET - 1)],
        # Search v2: queries/request 1.2 -> 4.8, plus organic traffic +20%
        effects=[("demand", "search-service", 1.20), ("ratio", ("search-service", "database"), 4.0)],
    ),
    "traffic_spike": dict(
        name="Traffic Spike",
        description="Image traffic jumps +340%; an unrelated search deploy lands just before it",
        expected="image-service",
        # Decoy: search deployed 2h before, but nothing about search changes
        deployments=[("search-service", "v2.1", ONSET - 2)],
        effects=[("demand", "image-service", 4.4)],
    ),
    "database_overload": dict(
        name="Database Overload",
        description="Order v3.0 ships an N+1 query bug that saturates the database",
        expected="order-service",
        deployments=[("order-service", "v3.0", ONSET - 1)],
        # Order v3 N+1 bug: queries/request 3 -> 10.5. Decoy: search +10% traffic
        effects=[("ratio", ("order-service", "database"), 3.5), ("demand", "search-service", 1.10)],
    ),
}
# Seeded incident history (PRD factor 5). Database has the MOST history on
# purpose: history alone must not be enough to blame it.
PRIOR_INCIDENTS = {"search-service": 1, "database": 2, "analytics": 1}


def generate(scenario, days=30, seed=7):
    """Hourly series for every node/edge, with diurnal cycle, noise, auth
    growth trend (decoy), and an analytics batch spike on day 15 (decoy)."""
    rng = np.random.default_rng(seed)
    spec = SCENARIOS[scenario]
    H = days * 24
    out = dict(hours=H, calls={e: np.zeros(H) for e in EDGES},
               inbound={n: np.zeros(H) for n in TOPO},
               cost={n: {} for n in TOPO}, db_cpu=np.zeros(H),
               latency={}, error={}, deployments=spec["deployments"])
    for h in range(H):
        day, hod = divmod(h, 24)
        diurnal = 1 + 0.25 * np.sin(2 * np.pi * (hod - 8) / 24)
        demand = {s: BASE_DEMAND[s] * diurnal * rng.lognormal(0, 0.03) for s in ENTRY}
        demand["auth-service"] *= 1 + 0.003 * day
        ratios = {e: r * rng.lognormal(0, 0.02) for e, r in base_ratios().items()}
        if h >= ONSET:
            for kind, target, mult in spec["effects"]:
                if kind == "demand":
                    demand[target] *= mult
                else:
                    ratios[target] *= mult
        st = steady_state(demand, ratios)
        if day == 15 and 2 <= hod < 5:
            st["cost"]["analytics"]["compute"] *= 3
        for e in EDGES:
            out["calls"][e][h] = st["calls"][e]
        for n in TOPO:
            out["inbound"][n][h] = st["inbound"][n]
            for rt, v in st["cost"][n].items():
                out["cost"][n].setdefault(rt, np.zeros(H))[h] = v * COST_SCALE
        for s, v in st["latency"].items():
            out["latency"].setdefault(s, np.zeros(H))[h] = v
            out["error"].setdefault(s, np.zeros(H))[h] = st["error"][s]
        out["db_cpu"][h] = st["db_cpu"]
    return out
