"""Root-cause scoring (PRD §22-23). Every service is scored the same way;
no service is special-cased by name."""
import numpy as np

from simulator.model import ENTRY, GATEWAY, KIND, PRIOR_INCIDENTS, QUERY_WEIGHT, TOPO, children, parents

from .anomaly import change, levels, onset, total_cost

W = dict(temporal=0.30, dependency=0.25, metric=0.20, cost=0.15, historical=0.10)


def score(factors):
    return sum(W[k] * v for k, v in factors.items())


def self_components(d, n):
    """Series describing behaviour that ORIGINATES at n (not load pushed onto
    it by callers). Services: user demand (if entry) + calls-per-request on
    each outbound edge. Database: CPU per unit of expected work."""
    comps = {}
    if KIND[n] == "service":
        if n in ENTRY:
            comps["user requests"] = d["calls"][(GATEWAY, n)]
        for c in children(n):
            label = f"queries/request to {c}" if c == "database" else f"calls/request to {c}"
            comps[label] = d["calls"][(n, c)] / d["inbound"][n]
    elif n == "database":
        expected_work = sum(d["calls"][(s, n)] * QUERY_WEIGHT[s] for s in parents(n))
        comps["CPU per unit of work"] = d["db_cpu"] / expected_work
    return comps


def score_candidates(d, base, cur, cost_on, search_from, corr_win):
    """Score every node on the five factors. The dependency factor needs the
    attribution pass, so it is left at 0 here and filled in by `finalize`."""
    tc = total_cost(d)
    tc_norm = tc / base.expected(tc)[0]
    candidates = []
    for n in TOPO:
        comps = self_components(d, n)
        changes = {k: float(change(s, base, cur)) for k, s in comps.items()}
        metric = max([min(1.0, abs(np.log(r)) / np.log(2)) for r in changes.values()], default=0.0)

        series = [d["inbound"][n]] + list(comps.values())
        ons = [o for o in (onset(s, base, search_from) for s in series) if o is not None]
        node_on = min(ons) if ons else None
        deploy = None
        if node_on is None:
            temporal = 0.0
        else:
            lag = node_on - cost_on
            onset_score = 1.0 if -3 <= lag <= 0 else float(np.exp(-abs(lag) / 2))
            # a deploy only counts if it lands just before this node's OWN change
            deploy = next((dict(version=v, hour=h, lead_hours=node_on - h)
                           for (s, v, h) in d["deployments"] if s == n and 0 <= node_on - h <= 3), None)
            temporal = onset_score * (0.6 + 0.4 * (deploy is not None))

        primary = max(comps, key=lambda k: abs(np.log(changes[k])), default=None)
        s = comps[primary] if primary else d["inbound"][n]
        s_norm = s / base.expected(s)[0]
        c = np.corrcoef(s_norm[corr_win], tc_norm[corr_win])[0, 1]
        cost = max(0.0, float(np.nan_to_num(c)))

        historical = min(1.0, 0.5 * PRIOR_INCIDENTS.get(n, 0))
        factors = dict(temporal=float(temporal), dependency=0.0, metric=float(metric),
                       cost=cost, historical=historical)
        candidates.append(dict(
            service=n, factors=factors, score=score(factors), changes=changes,
            levels={k: levels(s, base, cur) for k, s in comps.items()},
            primary=primary, onset=node_on, deploy=deploy,
            inbound_change=float(change(d["inbound"][n], base, cur)) if d["inbound"][n].any() else 1.0,
            prior_incidents=PRIOR_INCIDENTS.get(n, 0)))
    return candidates


def finalize(candidates, held, pos_total):
    """Dependency factor (§22 F2): share of the total cost increase that the
    graph traces back to this node through the calls it sends downstream."""
    for c in candidates:
        c["factors"]["dependency"] = float(sum(held[c["service"]].values()) / pos_total) if pos_total else 0.0
        c["score"] = score(c["factors"])
    candidates.sort(key=lambda c: -c["score"])
    return candidates
