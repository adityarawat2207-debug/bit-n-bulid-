"""Runs the engine end to end:
anomaly -> root cause -> attribution -> propagation -> trade-off."""
from .anomaly import Baseline, detect_anomaly, onset, total_cost
from .attribution import attribute, node_deltas
from .propagation import propagate
from .root_cause import finalize, score_candidates
from .tradeoff import operating_point, recommendations


def analyse(d):
    an = detect_anomaly(d)
    H = d["hours"]
    if an["day"] is None:
        # no active incident: compare the latest day with the 14 days before it
        last = len(an["daily"]) - 1
        base, cur = Baseline(last), slice(last * 24, H)
        return dict(anomaly=an, base=base, cur=cur, root=None, op=operating_point(d, base, cur))

    base = Baseline(an["day"])
    search_from = (an["day"] - 1) * 24
    cost_on = onset(total_cost(d), base, search_from)
    if cost_on is None:  # daily rule fired but no sustained hourly break
        cost_on = an["day"] * 24
    cur = slice(cost_on, H)
    corr_win = slice((an["day"] - 3) * 24, H)

    candidates = score_candidates(d, base, cur, cost_on, search_from, corr_win)
    delta = node_deltas(d, base, cur)
    metric_of = {c["service"]: c["factors"]["metric"] for c in candidates}
    held = attribute(d, delta, metric_of, base, cur)
    pos_total = sum(max(0.0, v) for v in delta.values())
    candidates = finalize(candidates, held, pos_total)
    root = candidates[0]
    op = operating_point(d, base, cur)

    return dict(anomaly=an, base=base, cur=cur, search_from=search_from, cost_onset=cost_on,
                delta=delta, candidates=candidates, root=root, held=held,
                propagation=propagate(d, root["service"], base, cur), op=op,
                recommendations=recommendations(root["service"], op))
