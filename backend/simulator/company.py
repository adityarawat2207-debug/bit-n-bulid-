"""A simulated company: dependency graph, steady-state model and hourly data
generator (PRD §9-10, §30-34).

One steady-state model is shared by the data generator (per hour, with noise)
and the trade-off simulator (what-if), so simulated fixes are consistent with
the data the engine analysed. Every company has the same structural roles: one
ingress (`api-gateway`) whose edges carry user demand, and one `database`, the
only node with a capacity model.
"""
from datetime import datetime, timedelta, timezone

import numpy as np

GATEWAY = "api-gateway"
DB = "database"

# Simulated day 0 starts here; hour h of the data is START + h hours.
START = datetime(2026, 8, 27, tzinfo=timezone.utc)
# Incidents start on day 26, 10:00 (hour index 634).
ONSET = 26 * 24 + 10


def iso(hour):
    return (START + timedelta(hours=int(hour))).strftime("%Y-%m-%dT%H:%M:%SZ")


def iso_date(day):
    return (START + timedelta(days=int(day))).strftime("%Y-%m-%d")


DB_LATENCY_KNEE = 0.88  # past this utilisation, extend 4/(1-rho) linearly


def db_latency(rho):
    """Queueing latency (ms) 4/(1-rho); linear past the knee so an already
    saturated database still gets slower (not stuck at a cap) as load grows."""
    if rho <= DB_LATENCY_KNEE:
        return 4.0 / (1 - rho)
    k = DB_LATENCY_KNEE
    return 4.0 / (1 - k) + 4.0 / (1 - k) ** 2 * (rho - k)


class Company:
    """Built from a spec module's constants (see shopx.py, ridenow.py).

    Cost lines are $/month at baseline load: `compute` {node: (fixed, variable)}
    scales with inbound load; `usage` {node: (category, fixed, variable)} does
    too; the database bills capacity + I/O; `network_total` is split by
    outbound calls; `storage` {node: fixed}."""

    def __init__(self, *, id, name, tagline, edges, kind, topo, base_demand, query_weight,
                 db_cpu_baseline, latency, hop_ms, compute, db_cost, network_total, usage,
                 storage, trend, batch_decoy, prior_incidents, scenarios, noise_stream=0):
        self.id, self.name, self.tagline = id, name, tagline
        self.EDGES, self.KIND, self.TOPO = edges, kind, topo
        self.ENTRY = [t for (s, t) in edges if s == GATEWAY]
        self.BASE_DEMAND, self.QUERY_WEIGHT = base_demand, query_weight
        self.LATENCY, self.HOP_MS = latency, hop_ms
        self.COMPUTE, self.DB_COST, self.NETWORK_TOTAL = compute, db_cost, network_total
        self.USAGE, self.STORAGE = usage, storage
        self.TREND, self.BATCH_DECOY = trend, batch_decoy
        self.PRIOR_INCIDENTS = prior_incidents
        self.SCENARIOS = scenarios
        self.noise_stream = noise_stream  # companies must not share a noise realisation
        self._base = None
        work = self.steady_state(base_demand, self.base_ratios(), db_capacity=1.0)["work"]
        self.DB_CAPACITY = work / db_cpu_baseline
        self._base = self.steady_state(base_demand, self.base_ratios())

    def parents(self, n):
        return [s for (s, t) in self.EDGES if t == n]

    def children(self, n):
        return [t for (s, t) in self.EDGES if s == n]

    def base_ratios(self):
        return {e: r for e, r in self.EDGES.items() if r is not None}

    def steady_state(self, demand, ratios, db_capacity=None):
        """Return per-node inbound load, per-edge calls, DB utilisation,
        latency (ms), error rate (%) and cost ($/hour, by resource type)."""
        db_capacity = self.DB_CAPACITY if db_capacity is None else db_capacity
        inbound = {n: 0.0 for n in self.TOPO}
        calls = {}
        inbound[GATEWAY] = sum(demand.values())
        for n in self.TOPO:
            for c in self.children(n):
                e = (n, c)
                calls[e] = demand[c] if n == GATEWAY else inbound[n] * ratios[e]
                inbound[c] += calls[e]
        work = sum(calls[(s, DB)] * self.QUERY_WEIGHT[s] for s in self.parents(DB))
        rho = work / db_capacity
        db_lat = db_latency(rho)
        reject = max(0.0, 1 - 1 / rho) if rho > 1 else 0.0
        db_err = 100 * reject + (0.5 * (rho - 0.85) / 0.15 if rho > 0.85 else 0.0)

        latency, error = {}, {}
        for s, base in self.LATENCY.items():
            q = ratios.get((s, DB), 0.0)
            latency[s] = base + q * db_lat + sum(ratios.get((s, c), 0.0) * ms for c, ms in self.HOP_MS.items())
            error[s] = 0.1 + (db_err if q else 0.0)

        cost = self.monthly_costs(inbound, calls, work, db_capacity)
        return dict(inbound=inbound, calls=calls, work=work, db_cpu=rho,
                    db_latency=db_lat, latency=latency, error=error, cost=cost)

    def _wout(self, n, calls):
        return sum(calls[(n, c)] for c in self.children(n))

    def monthly_costs(self, inbound, calls, work, db_capacity):
        """Cost in $/hour by node and resource type (monthly budget / 720)."""
        if self._base is None:  # first call computes the baseline loads themselves
            return {n: {} for n in self.TOPO}
        b = self._base
        wtot = sum(self._wout(n, b["calls"]) for n in self.TOPO)
        c = {n: {} for n in self.TOPO}
        for n, (fix, var) in self.COMPUTE.items():
            c[n]["compute"] = fix + var * inbound[n] / b["inbound"][n]
        for n in self.TOPO:
            if self._wout(n, b["calls"]):
                c[n]["network"] = self.NETWORK_TOTAL * self._wout(n, calls) / wtot
        cap_cost, io_cost = self.DB_COST
        c[DB]["database"] = cap_cost * db_capacity / self.DB_CAPACITY + io_cost * work / b["work"]
        for n, (category, fix, var) in self.USAGE.items():
            c[n][category] = fix + var * inbound[n] / b["inbound"][n]
        for n, v in self.STORAGE.items():
            c[n]["storage"] = v
        return {n: {k: v / 720 for k, v in d.items()} for n, d in c.items()}

    def generate(self, spec, days=30, seed=7):
        """Hourly series for every node/edge, with diurnal cycle, noise, a slow
        growth trend (decoy) and a resolved batch spike (decoy)."""
        rng = np.random.default_rng([seed, self.noise_stream] if self.noise_stream else seed)
        H = days * 24
        out = dict(company=self, hours=H, calls={e: np.zeros(H) for e in self.EDGES},
                   inbound={n: np.zeros(H) for n in self.TOPO},
                   cost={n: {} for n in self.TOPO}, db_cpu=np.zeros(H),
                   latency={}, error={}, deployments=spec["deployments"])
        trend_svc, trend_rate = self.TREND
        b_node, b_cat, b_day, b_from, b_to, b_mult = self.BATCH_DECOY
        for h in range(H):
            day, hod = divmod(h, 24)
            diurnal = 1 + 0.25 * np.sin(2 * np.pi * (hod - 8) / 24)
            demand = {s: self.BASE_DEMAND[s] * diurnal * rng.lognormal(0, 0.03) for s in self.ENTRY}
            demand[trend_svc] *= 1 + trend_rate * day
            ratios = {e: r * rng.lognormal(0, 0.02) for e, r in self.base_ratios().items()}
            if h >= ONSET:
                for kind, target, mult in spec["effects"]:
                    if kind == "demand":
                        demand[target] *= mult
                    else:
                        ratios[target] *= mult
            st = self.steady_state(demand, ratios)
            if day == b_day and b_from <= hod < b_to:
                st["cost"][b_node][b_cat] *= b_mult
            for e in self.EDGES:
                out["calls"][e][h] = st["calls"][e]
            for n in self.TOPO:
                out["inbound"][n][h] = st["inbound"][n]
                for rt, v in st["cost"][n].items():
                    out["cost"][n].setdefault(rt, np.zeros(H))[h] = v
            for s, v in st["latency"].items():
                out["latency"].setdefault(s, np.zeros(H))[h] = v
                out["error"].setdefault(s, np.zeros(H))[h] = st["error"][s]
            out["db_cpu"][h] = st["db_cpu"]
        return out
