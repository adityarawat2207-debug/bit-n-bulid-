"""Registry of simulated companies and their scenarios.

Scenario ids are unique across companies, so every endpoint still takes just
`?scenario=`; the scenario decides which company's model generates the data.
"""
from . import ridenow, shopx
from .company import DB, GATEWAY, ONSET, START, iso, iso_date  # noqa: F401

COMPANIES = {c.id: c for c in (shopx.COMPANY, ridenow.COMPANY)}

# scenario id -> spec (with its company attached)
SCENARIOS = {}
for _co in COMPANIES.values():
    for _sid, _spec in _co.SCENARIOS.items():
        assert _sid not in SCENARIOS, f"duplicate scenario id {_sid}"
        SCENARIOS[_sid] = dict(_spec, company=_co)


def baseline_of(company):
    return next(s for s, spec in company.SCENARIOS.items() if spec["expected"] is None)


def generate(scenario, days=30, seed=7):
    spec = SCENARIOS[scenario]
    return spec["company"].generate(spec, days=days, seed=seed)
