"""CloudPulse API. Stateless: every call names a scenario (docs/api-contract.md)."""
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai.explainer import explain
from app import views

app = FastAPI(title="CloudPulse API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
api = APIRouter(prefix="/api/v1")

SCENARIO = Query("baseline", description="Scenario id from /scenarios")


class WhatIfRequest(BaseModel):
    scenario: str
    action: dict[str, Any]


class ExplainRequest(BaseModel):
    scenario: str


def _call(fn, *args):
    try:
        return fn(*args)
    except views.UnknownScenario as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(422, str(e))


@api.get("/health")
def health():
    return {"ok": True}


@api.get("/scenarios")
def scenarios():
    return views.scenarios()


@api.get("/overview")
def overview(scenario: str = SCENARIO):
    return _call(views.overview, scenario)


@api.get("/incident")
def incident(scenario: str = SCENARIO):
    return _call(views.incident, scenario)


@api.post("/whatif")
def whatif(req: WhatIfRequest):
    return _call(views.whatif, req.scenario, req.action)


@api.post("/explain")
def explain_incident(req: ExplainRequest):
    return _call(lambda s: explain(views.incident(s)), req.scenario)


app.include_router(api)
