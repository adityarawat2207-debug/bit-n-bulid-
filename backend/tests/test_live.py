from app import live
from simulator.company import DB


def fresh(monkeypatch):
    monkeypatch.setattr(live, "_store", live.MemoryStore())


def test_healthy_store_changes_nothing(monkeypatch):
    fresh(monkeypatch)
    live.record("search-service", "v1.9", 1, 20.0)
    spec, s = live.spec()
    assert s["requests_total"] == 1 and s["multiplier"] == 1.0
    assert spec == dict(deployments=[], effects=[])


def test_n_plus_one_becomes_a_ratio_effect_with_its_deploy(monkeypatch):
    fresh(monkeypatch)
    live.record("order-service", "v1.4", 3, 10.0)
    for _ in range(3):
        live.record("search-service", "v2.0", 37, 150.0)
    spec, s = live.spec()
    assert s["requests_total"] == 3 and s["db_queries_per_request"] == 37
    assert s["versions"] == {"order-service": "v1.4", "search-service": "v2.0"}
    assert [d[:2] for d in spec["deployments"]] == [("search-service", "v2.0")]
    assert spec["effects"] == [("ratio", ("search-service", DB), round(37 / 1.2, 2))]


def test_reset_clears_everything(monkeypatch):
    fresh(monkeypatch)
    live.record("search-service", "v2.0", 37, 150.0)
    live.reset()
    s = live.status()
    assert s["requests_total"] == 0 and s["db_queries_per_request"] is None and s["versions"] == {}


def test_telemetry_endpoints(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    fresh(monkeypatch)
    c = TestClient(app)
    c.post("/api/v1/telemetry", json=dict(service="search-service", version="v2.0",
                                          route="/api/search", db_queries=37, latency_ms=150))
    assert c.get("/api/v1/live").json()["requests_total"] == 1
    assert c.get("/api/v1/overview?scenario=shopx_live").json()["kpis"]["active_anomalies"] >= 1
    assert c.post("/api/v1/live/reset").json()["requests_total"] == 0
