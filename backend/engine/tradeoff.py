"""Cost vs performance trade-off (PRD §27-29, §34). A fix is simulated on the
same steady-state model that generated the data, starting from the operating
point the engine measured."""
from simulator.model import DB_CAPACITY, EDGES, ENTRY, GATEWAY, KIND, children, steady_state

LIMITS = dict(latency_pct=10.0, error_pp=0.5, db_cpu=0.85)
ACTION_TYPES = ("fix_amplification", "rate_limit", "reduce_capacity")
CAPACITY_TARGETS = ("database",)  # the only node with a capacity model


def operating_point(d, base, cur):
    """Mean demand and calls-per-request now (cur) and in the baseline window."""
    now = lambda x: float(x[cur].mean())
    before = lambda x: float(x[base.lo:base.hi].mean())
    internal = [e for e in EDGES if e[0] != GATEWAY]
    ratio = lambda e: d["calls"][e] / d["inbound"][e[0]]
    return dict(
        demand={s: now(d["calls"][(GATEWAY, s)]) for s in ENTRY},
        ratios={e: now(ratio(e)) for e in internal},
        base_demand={s: before(d["calls"][(GATEWAY, s)]) for s in ENTRY},
        base_ratios={e: before(ratio(e)) for e in internal},
    )


def validate(action):
    t = action.get("type")
    if t not in ACTION_TYPES:
        raise ValueError(f"unknown action type {t!r}; expected one of {', '.join(ACTION_TYPES)}")
    if t == "fix_amplification":
        e = (action.get("source"), action.get("target"))
        if e not in EDGES or e[0] == GATEWAY:
            raise ValueError(f"no service-to-service edge {e[0]} -> {e[1]}")
        return
    value = action.get("value")
    if not isinstance(value, (int, float)) or not 0.1 <= value <= 5:
        raise ValueError("value must be a number between 0.1 and 5")
    if t == "rate_limit" and action.get("target") not in ENTRY:
        raise ValueError(f"rate_limit target must be one of {', '.join(ENTRY)}")
    if t == "reduce_capacity" and action.get("target") not in CAPACITY_TARGETS:
        raise ValueError(f"reduce_capacity target must be one of {', '.join(CAPACITY_TARGETS)}")


def describe(action):
    t = action["type"]
    if t == "fix_amplification":
        s, tgt = action["source"], action["target"]
        what = "query" if tgt == "database" else "call"
        return f"fix_amplification:{s}:{tgt}", f"Fix {s} {what} amplification to {tgt}"
    v = action["value"]
    if t == "rate_limit":
        return f"rate_limit:{action['target']}:{v:g}", f"Rate-limit {action['target']} to {v:g}x baseline traffic"
    if v < 1:
        title = f"Reduce {action['target']} capacity {100 * (1 - v):.0f}%"
    else:
        title = f"Add {action['target']} capacity +{100 * (v - 1):.0f}%"
    return f"reduce_capacity:{action['target']}:{v:g}", title


def _apply(action, op):
    demand, ratios, cap = dict(op["demand"]), dict(op["ratios"]), 1.0
    t = action["type"]
    if t == "fix_amplification":
        e = (action["source"], action["target"])
        ratios[e] = op["base_ratios"][e]
    elif t == "rate_limit":
        s = action["target"]
        demand[s] = min(demand[s], op["base_demand"][s] * action["value"])
    else:
        cap = action["value"]
    return demand, ratios, cap


def evaluate(op, action):
    """Simulate one action from the measured operating point."""
    validate(action)
    before = steady_state(op["demand"], op["ratios"])
    demand, ratios, cap = _apply(action, op)
    after = steady_state(demand, ratios, DB_CAPACITY * cap)
    monthly = lambda st: sum(sum(v.values()) for v in st["cost"].values()) * 24 * 30
    worst_err = lambda st: max(st["error"].values())
    savings = monthly(before) - monthly(after)
    # the service whose latency moves most, in either direction
    latency_pct = max((100 * (after["latency"][s] / before["latency"][s] - 1) for s in before["latency"]), key=abs)
    error_pp = worst_err(after) - worst_err(before)
    db_cpu = after["db_cpu"]

    reasons = []
    if latency_pct > LIMITS["latency_pct"]:
        reasons.append(f"latency +{latency_pct:.0f}% > +{LIMITS['latency_pct']:.0f}% limit")
    if error_pp > LIMITS["error_pp"]:
        reasons.append(f"error rate +{error_pp:.1f}pp > +{LIMITS['error_pp']}pp limit")
    if db_cpu > LIMITS["db_cpu"]:
        reasons.append(f"DB CPU {db_cpu:.0%} > {LIMITS['db_cpu']:.0%} headroom limit")
    performance_bad = bool(reasons)
    if savings <= 0:
        reasons.append(f"costs ${-savings:,.0f}/month more instead of saving")

    if performance_bad:
        risk = "high"
    elif reasons or action["type"] == "rate_limit" or latency_pct > LIMITS["latency_pct"] / 2:
        risk = "medium"
    else:
        risk = "low"
    rid, title = describe(action)
    return dict(id=rid, title=title, action=action,
                savings_monthly=round(savings), latency_pct=round(latency_pct, 1),
                error_pp=round(error_pp, 2), db_cpu=round(db_cpu, 3), risk=risk,
                verdict="NOT RECOMMENDED" if reasons else "RECOMMENDED", reasons=reasons)


def candidate_actions(root, op):
    """Three options (PRD §27-29): fix the cause, treat the symptom by adding
    capacity, and the 'bad optimization' of cutting capacity (§34), which
    must always be last."""
    actions = []
    amplified = [((root, c), op["ratios"][(root, c)] / op["base_ratios"][(root, c)])
                 for c in children(root) if (root, c) in op["ratios"]]
    edge, ratio = max(amplified, key=lambda t: t[1], default=(None, 1.0))
    if ratio > 1.5:
        actions.append(dict(type="fix_amplification", source=edge[0], target=edge[1]))
    elif root in ENTRY and KIND[root] == "service":
        actions.append(dict(type="rate_limit", target=root, value=1.2))
    actions.append(dict(type="reduce_capacity", target="database", value=1.25))
    actions.append(dict(type="reduce_capacity", target="database", value=0.75))
    return actions


def recommendations(root, op):
    return [evaluate(op, a) for a in candidate_actions(root, op)]
