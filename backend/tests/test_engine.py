from pathlib import Path

import pytest

from engine.pipeline import analyse
from engine.tradeoff import evaluate
from simulator.company import DB, GATEWAY
from simulator.model import COMPANIES, SCENARIOS, generate

INCIDENTS = [s for s, spec in SCENARIOS.items() if spec["expected"]]
BASELINES = [s for s, spec in SCENARIOS.items() if not spec["expected"]]
SEEDS = range(1, 21)


@pytest.mark.parametrize("scenario", INCIDENTS)
@pytest.mark.parametrize("seed", SEEDS)
def test_root_cause_found_with_margin(scenario, seed):
    r = analyse(generate(scenario, seed=seed))
    first, second = r["candidates"][:2]
    assert first["service"] == SCENARIOS[scenario]["expected"]
    assert first["score"] - second["score"] >= 0.15, (first["service"], second["service"])


@pytest.mark.parametrize("scenario", BASELINES)
def test_baseline_has_no_incident_on_demo_data(scenario):
    assert analyse(generate(scenario))["root"] is None


@pytest.mark.parametrize("scenario", BASELINES)
def test_baseline_false_alarm_rate_is_low(scenario):
    # §17's mean + 2*std rule over 14 days fires on a quiet baseline ~5% of the
    # time by chance, so test the rate over many seeds, not a lucky few.
    alarms = sum(analyse(generate(scenario, seed=s))["root"] is not None for s in range(1, 101))
    assert alarms <= 8


@pytest.mark.parametrize("scenario", INCIDENTS)
def test_scores_are_normalised(scenario):
    for c in analyse(generate(scenario))["candidates"]:
        assert 0 <= c["score"] <= 1
        assert all(0 <= v <= 1 for v in c["factors"].values())


@pytest.mark.parametrize("scenario,verdict", [
    ("search_query_explosion", "NOT RECOMMENDED"),
    ("database_overload", "NOT RECOMMENDED"),
    ("traffic_spike", "RECOMMENDED"),
    ("ridenow_surge_pricing_storm", "NOT RECOMMENDED"),
    ("ridenow_gps_ping_flood", "NOT RECOMMENDED"),
    ("ridenow_matching_retry_storm", "NOT RECOMMENDED"),
])
def test_bad_optimization_depends_on_database_headroom(scenario, verdict):
    r = analyse(generate(scenario))
    cut = evaluate(r["op"], dict(type="reduce_capacity", target="database", value=0.75))
    assert cut["verdict"] == verdict
    assert r["recommendations"][-1]["action"] == cut["action"]


@pytest.mark.parametrize("scenario", INCIDENTS)
def test_top_recommendation_fixes_the_cause(scenario):
    top = analyse(generate(scenario))["recommendations"][0]
    assert top["verdict"] == "RECOMMENDED"
    assert top["savings_monthly"] > 0
    assert SCENARIOS[scenario]["expected"] in (top["action"].get("source"), top["action"].get("target"))


def test_engine_never_names_a_specific_service():
    # CLAUDE.md rule: score every candidate, never hard-code the answer
    # (the gateway and database are shared structural roles, not answers)
    services = {n for co in COMPANIES.values() for n in co.TOPO} - {GATEWAY, DB}
    engine = Path(__file__).resolve().parents[1] / "engine"
    for f in engine.glob("*.py"):
        text = f.read_text()
        for n in services:
            assert n not in text, (f.name, n)
