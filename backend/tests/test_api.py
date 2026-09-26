import pytest
from fastapi.testclient import TestClient

from ai.explainer import unsupported_numbers
from app.main import app
from simulator.model import SCENARIOS

client = TestClient(app)
INCIDENTS = [s for s, spec in SCENARIOS.items() if spec["expected"]]
BASELINES = [s for s, spec in SCENARIOS.items() if not spec["expected"]]
CATEGORIES = {
    "shopx": {"compute", "database", "network", "cache", "storage", "cdn"},
    "ridenow": {"compute", "database", "network", "cache", "queue", "maps", "storage"},
}


def get(path, **params):
    r = client.get(f"/api/v1{path}", params=params)
    assert r.status_code == 200, r.text
    return r.json()


def post(path, body):
    r = client.post(f"/api/v1{path}", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_health():
    assert get("/health") == {"ok": True}


def test_scenarios_lists_every_company():
    listed = get("/scenarios")
    assert [s["id"] for s in listed] == list(SCENARIOS)
    assert {s["company"] for s in listed} == {"shopx", "ridenow"}
    for s in listed:
        assert s["baseline"] in BASELINES
        assert SCENARIOS[s["baseline"]]["company"].id == s["company"]


@pytest.mark.parametrize("scenario", list(SCENARIOS))
def test_overview_shape(scenario):
    o = get("/overview", scenario=scenario)
    k = o["kpis"]
    cats = CATEGORIES[o["company"]]
    assert o["company"] == SCENARIOS[scenario]["company"].id
    assert {b["category"] for b in o["breakdown"]} == cats
    assert abs(sum(b["current"] for b in o["breakdown"]) - k["current_monthly"]) <= len(cats)
    assert abs(sum(s["cost_current"] for s in o["services"]) - k["current_monthly"]) <= len(o["services"])
    assert len(o["hourly"]) == 7 * 24 and len(o["daily"]) == 30
    incident = scenario in INCIDENTS
    assert o["daily"][-1]["anomalous"] == incident
    assert o["active_incident_id"] == (scenario if incident else None)


@pytest.mark.parametrize("scenario,monthly", [("baseline", 10240), ("ridenow_baseline", 13980)])
def test_baseline_reads_its_budget(scenario, monthly):
    k = get("/overview", scenario=scenario)["kpis"]
    assert abs(k["baseline_monthly"] - monthly) < 150
    assert abs(k["change_pct"]) < 3
    assert k["active_anomalies"] == 0 and k["preventable_monthly"] == 0


@pytest.mark.parametrize("scenario", BASELINES)
def test_baseline_has_no_incident(scenario):
    assert get("/incident", scenario=scenario) == {"incident": None}


@pytest.mark.parametrize("scenario", INCIDENTS)
def test_incident_shape(scenario):
    inc = get("/incident", scenario=scenario)
    root = SCENARIOS[scenario]["expected"]
    assert inc["root_cause"]["service"] == root
    assert inc["root_cause"]["evidence"]
    assert len(inc["candidates"]) == len(inc["graph"]["nodes"]) - 1
    assert all(c["why_not"] for c in inc["candidates"])
    states = {n["id"]: n["state"] for n in inc["graph"]["nodes"]}
    assert states[root] == "root" and "affected" in states.values()
    assert any(e["on_propagation_path"] for e in inc["graph"]["edges"])
    assert inc["timeline"][-1]["label"].startswith("Cost anomaly detected")
    assert inc["impact"]["by_cause"][0]["service"] == root
    assert len(inc["recommendations"]) == 3
    assert inc["recommendations"][-1]["action"] == {"type": "reduce_capacity", "target": "database", "value": 0.75}


def test_whatif_matches_listed_recommendation():
    rec = get("/incident", scenario="search_query_explosion")["recommendations"][0]
    assert post("/whatif", {"scenario": "search_query_explosion", "action": rec["action"]}) == rec


@pytest.mark.parametrize("action", [
    {"type": "explode"},
    {"type": "fix_amplification", "source": "cdn", "target": "database"},
    {"type": "rate_limit", "target": "database", "value": 1.2},
    {"type": "reduce_capacity", "target": "database", "value": "lots"},
])
def test_whatif_rejects_bad_actions(action):
    r = client.post("/api/v1/whatif", json={"scenario": "traffic_spike", "action": action})
    assert r.status_code == 422


def test_unknown_scenario_is_404():
    assert client.get("/api/v1/overview", params={"scenario": "nope"}).status_code == 404


@pytest.mark.parametrize("scenario", INCIDENTS)
def test_template_explanation_uses_only_known_numbers(scenario, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    inc = get("/incident", scenario=scenario)
    e = post("/explain", {"scenario": scenario})
    assert e["source"] == "template"
    assert inc["root_cause"]["service"] in e["text"]
    assert unsupported_numbers(e["text"], inc) == []


def test_number_guard_catches_invented_numbers():
    inc = get("/incident", scenario="search_query_explosion")
    assert unsupported_numbers("Cost rose by $98,765 per month", inc) == [98765.0]


def test_explain_baseline():
    assert post("/explain", {"scenario": "baseline"})["source"] == "template"
