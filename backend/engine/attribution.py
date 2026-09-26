"""Cost attribution (PRD §26): an *estimated* contribution model."""
from simulator.model import ENTRY, GATEWAY, KIND, TOPO, children, parents

from .anomaly import node_cost, run_rates


def node_deltas(d, base, cur):
    """Monthly run-rate cost change of every node."""
    out = {}
    for n in TOPO:
        before, now = run_rates(node_cost(d, n), base, cur)
        out[n] = now - before
    return out


def attribute(d, delta, metric_of, base, cur):
    """Push each node's cost increase up to its callers in proportion to the
    increase in calls each caller sent. Entry services (demand origin) and
    services with their own behaviour change keep what reaches them.

    Returns {holder: {node where the cost landed: $/month}}."""
    held = {n: {n: max(0.0, delta[n])} for n in TOPO}
    for n in reversed(TOPO):
        keeps = KIND[n] == "service" and (n in ENTRY or metric_of[n] >= 0.3)
        if n == GATEWAY:
            targets = {c: d["calls"][(n, c)] for c in children(n)}
        elif not keeps:
            targets = {p: d["calls"][(p, n)] for p in parents(n)}
        else:
            continue
        dcalls = {t: max(0.0, s[cur].mean() - base.expected(s)[0][cur].mean()) for t, s in targets.items()}
        tot = sum(dcalls.values())
        if tot == 0:
            continue
        for t, dc in dcalls.items():
            for landed, amt in held[n].items():
                held[t][landed] = held[t].get(landed, 0) + amt * dc / tot
        held[n] = {}
    return held
