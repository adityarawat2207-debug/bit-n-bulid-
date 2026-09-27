"""Turn engine output into the JSON shapes in docs/api-contract.md."""
from functools import lru_cache

from engine.anomaly import levels, node_cost, onset, run_rates, total_cost
from engine.pipeline import analyse
from engine.tradeoff import evaluate
from simulator.model import SCENARIOS, baseline_of, generate, iso, iso_date

from . import live

DETECT_AFTER_HOURS = 2  # the onset rule needs 2 sustained hours before it fires


class UnknownScenario(ValueError):
    pass


def run(scenario):
    if scenario not in SCENARIOS:
        raise UnknownScenario(f"unknown scenario {scenario!r}; expected one of {', '.join(SCENARIOS)}")
    if SCENARIOS[scenario].get("live"):
        spec, _ = live.spec()
        return _run_live(scenario, tuple(spec["deployments"]), tuple(spec["effects"]))
    return _run(scenario)


@lru_cache(maxsize=None)
def _run(scenario):
    """Generate + analyse. Deterministic per scenario, so caching keeps the
    backend stateless while avoiding repeat work."""
    d = generate(scenario)
    return d, analyse(d)


@lru_cache(maxsize=32)
def _run_live(scenario, deployments, effects):
    """Same, for a spec built from live telemetry (cached per distinct spec)."""
    co = SCENARIOS[scenario]["company"]
    d = co.generate(dict(deployments=list(deployments), effects=list(effects)))
    return d, analyse(d)


def scenarios():
    return [dict(id=s, name=v["name"], description=v["description"], company=v["company"].id,
                 company_name=v["company"].name, baseline=baseline_of(v["company"]))
            for s, v in SCENARIOS.items()]


def _costs(d, r):
    """(baseline, current) monthly run-rate for every (node, resource type)."""
    return {(n, rt): run_rates(x, r["base"], r["cur"]) for n in d["company"].TOPO for rt, x in d["cost"][n].items()}


def _totals(costs):
    before = sum(b for b, _ in costs.values())
    now = sum(c for _, c in costs.values())
    return before, now, 100 * (now / before - 1)


def overview(scenario):
    d, r = run(scenario)
    costs = _costs(d, r)
    before, now, pct = _totals(costs)
    has_incident = r["root"] is not None
    top = r["recommendations"][0] if has_incident else None

    tc = total_cost(d)
    mu = r["base"].expected(tc)[0]
    hourly = [dict(t=iso(h), cost_monthly=round(tc[h] * 720), baseline_monthly=round(mu[h] * 720))
              for h in range(d["hours"] - 7 * 24, d["hours"])]
    an = r["anomaly"]
    daily = [dict(date=iso_date(i), cost=round(float(c), 1), anomalous=i in an["flagged"])
             for i, c in enumerate(an["daily"])]

    categories = {}
    for (n, rt), (b, c) in costs.items():
        cb, cc = categories.get(rt, (0.0, 0.0))
        categories[rt] = (cb + b, cc + c)
    breakdown = [dict(category=k, baseline=round(b), current=round(c))
                 for k, (b, c) in sorted(categories.items(), key=lambda kv: -kv[1][1])]

    co = d["company"]
    services = []
    for n in co.TOPO:
        b = sum(v[0] for (m, _), v in costs.items() if m == n)
        c = sum(v[1] for (m, _), v in costs.items() if m == n)
        services.append(dict(id=n, kind=co.KIND[n], cost_baseline=round(b), cost_current=round(c),
                             change_pct=round(100 * (c / b - 1), 1) if b else 0.0))

    return dict(
        scenario=scenario,
        company=co.id,
        kpis=dict(current_monthly=round(now), baseline_monthly=round(before), change_pct=round(pct, 1),
                  active_anomalies=int(has_incident),
                  preventable_monthly=top["savings_monthly"] if top and top["verdict"] == "RECOMMENDED" else 0),
        hourly=hourly, daily=daily, breakdown=breakdown, services=services,
        active_incident_id=scenario if has_incident else None,
    )


# ------------------------------------------------------------------ incident
def _fmt_ratio_line(label, ratio, before, after):
    verb = "rose" if ratio >= 1 else "fell"
    if label == "user requests":
        return f"User requests {verb} x{ratio:.2f} ({before:,.0f} → {after:,.0f} per minute)"
    return f"{label[0].upper() + label[1:]} {verb} x{ratio:.2f} ({before:.2f} → {after:.2f})"


def _evidence(c, r):
    ev = []
    for k, ratio in sorted(c["changes"].items(), key=lambda kv: -abs(kv[1] - 1)):
        if abs(ratio - 1) >= 0.1:
            ev.append(_fmt_ratio_line(k, ratio, *c["levels"][k]))
    if c["deploy"]:
        lead = c["deploy"]["lead_hours"]
        when = "in the same hour" if lead == 0 else f"{lead}h"
        ev.append(f"Deployed {c['deploy']['version']} {when} before its own behaviour changed")
    dep = c["factors"]["dependency"]
    if dep > 0:
        ev.append(f"Accounts for {dep:.0%} of the estimated cost increase through the services it calls")
    for src, dst, ratio in r["propagation"]:
        if src == c["service"]:
            ev.append(f"Total calls to {dst} rose x{ratio:.2f}")
    if c["factors"]["cost"] >= 0.7:
        ev.append(f"Its change tracks the total cost curve (correlation {c['factors']['cost']:.2f})")
    if c["prior_incidents"]:
        n = c["prior_incidents"]
        ev.append(f"{n} similar past incident{'s' if n > 1 else ''} on record")
    return ev


def _why_not(c, d, r):
    n, m = c["service"], c["factors"]["metric"]
    kind = d["company"].KIND[n]
    window_start = r["search_from"] - 48
    deploys = [(v, h) for (s, v, h) in d["deployments"] if s == n and h >= window_start]
    k = c["primary"]
    own = c["changes"][k] if k else 1.0
    if deploys and m < 0.3:
        v, h = deploys[-1]
        return f"Deployed {v} at {iso(h)[11:16]}, but its own behaviour did not change afterwards"
    if abs(own - 1) >= 0.05:
        return (f"Its own change ({k} x{own:.2f}) is real but explains only "
                f"{c['factors']['dependency']:.0%} of the estimated cost increase")
    if kind == "ingress" and c["inbound_change"] > 1.05:
        return (f"Its load rose x{c['inbound_change']:.2f}, but it only forwards user traffic; "
                "the extra requests belong to the services behind it")
    if c["inbound_change"] > 1.05:
        return (f"Its load rose x{c['inbound_change']:.2f}, but that load is pushed by its callers; "
                "its own behaviour did not change")
    return "No meaningful change in its own behaviour or load"


def _factors(c):
    return {k: round(v, 2) for k, v in c["factors"].items()}


def _severity(pct):
    return "high" if pct >= 25 else "medium" if pct >= 10 else "low"


def incident(scenario):
    d, r = run(scenario)
    if r["root"] is None:
        return dict(incident=None)
    co = d["company"]
    base, cur, root = r["base"], r["cur"], r["root"]
    _, _, pct = _totals(_costs(d, r))
    cost_on = r["cost_onset"]
    prop_edges = {(a, b) for a, b, _ in r["propagation"]}
    affected = {b for _, b in prop_edges}

    nodes = []
    for n in co.TOPO:
        b, c = run_rates(node_cost(d, n), base, cur)
        state = "root" if n == root["service"] else "affected" if n in affected else "normal"
        nodes.append(dict(id=n, kind=co.KIND[n], state=state, change_pct=round(100 * (c / b - 1), 1)))
    edges = []
    for (s, t) in co.EDGES:
        before, now = levels(d["calls"][(s, t)], base, cur)
        edges.append(dict(source=s, target=t, calls_change_pct=round(100 * (now / before - 1), 1),
                          on_propagation_path=(s, t) in prop_edges))

    timeline = []
    for (s, v, h) in d["deployments"]:
        if h >= r["search_from"] - 48:
            timeline.append((h, 0, s, f"{s} {v} deployed"))
    if root["onset"] is not None and root["primary"]:
        ratio = root["changes"][root["primary"]]
        timeline.append((root["onset"], 1, root["service"], f"{root['primary']} up x{ratio:.2f}"))
    for _, t, _ in r["propagation"]:
        h = onset(d["inbound"][t], base, r["search_from"])
        if h is not None:
            before, now = levels(d["inbound"][t], base, cur)
            timeline.append((h, 2, t, f"{t} load up x{now / before:.2f}"))
    timeline.append((cost_on, 3, None, "Cloud cost starts rising"))
    timeline.append((cost_on + DETECT_AFTER_HOURS, 4, None, f"Cost anomaly detected (+{pct:.1f}%)"))
    timeline = [dict(t=iso(h), service=s, label=label) for h, _, s, label in sorted(timeline, key=lambda e: e[:2])]

    by_cause = []
    for holder, landed in r["held"].items():
        amount = sum(landed.values())
        if amount > 50:
            by_cause.append(dict(service=holder, amount=round(amount), landed=[
                dict(service=k, amount=round(v)) for k, v in sorted(landed.items(), key=lambda kv: -kv[1]) if v >= 1]))
    by_cause.sort(key=lambda c: -c["amount"])

    return dict(
        incident=dict(id=scenario, detected_at=iso(cost_on + DETECT_AFTER_HOURS), onset_at=iso(cost_on),
                      severity=_severity(pct), cost_change_pct=round(pct, 1)),
        root_cause=dict(service=root["service"], confidence=round(root["score"], 2),
                        factors=_factors(root), evidence=_evidence(root, r)),
        candidates=[dict(service=c["service"], confidence=round(c["score"], 2), factors=_factors(c),
                         why_not=_why_not(c, d, r)) for c in r["candidates"][1:]],
        graph=dict(nodes=nodes, edges=edges),
        timeline=timeline,
        impact=dict(total_monthly=sum(c["amount"] for c in by_cause), by_cause=by_cause),
        recommendations=r["recommendations"],
    )


def whatif(scenario, action):
    _, r = run(scenario)
    return evaluate(r["op"], action)
