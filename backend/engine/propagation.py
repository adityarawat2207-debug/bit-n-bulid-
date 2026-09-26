"""Propagation (PRD §25): walk the dependency graph down from the root cause,
following edges whose call volume rose."""
from simulator.model import children

from .anomaly import change


def propagate(d, root, base, cur, min_ratio=1.05):
    """Return [(source, target, calls ratio)] in breadth-first order."""
    prop, frontier, seen = [], [root], {root}
    while frontier:
        n = frontier.pop(0)
        for c in children(n):
            r = float(change(d["calls"][(n, c)], base, cur))
            if r > min_ratio and c not in seen:
                prop.append((n, c, r))
                seen.add(c)
                frontier.append(c)
    return prop
