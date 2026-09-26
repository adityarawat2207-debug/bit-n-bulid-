"""Write real API responses to frontend/public/mocks/ so the frontend can
build with NEXT_PUBLIC_MOCK=1. Re-run after any engine or contract change:

    cd backend && .venv/bin/python -m scripts.export_mocks
"""
import json
import os
from pathlib import Path

from ai.explainer import explain
from app import views
from simulator.model import SCENARIOS

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "mocks"


def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=1) + "\n")


def main():
    os.environ.pop("ANTHROPIC_API_KEY", None)  # mocks always use the template
    OUT.mkdir(parents=True, exist_ok=True)
    write("scenarios.json", views.scenarios())
    for s in SCENARIOS:
        inc = views.incident(s)
        write(f"overview.{s}.json", views.overview(s))
        write(f"incident.{s}.json", inc)
        write(f"explain.{s}.json", explain(inc))
    print(f"wrote {len(list(OUT.glob('*.json')))} files to {OUT}")


if __name__ == "__main__":
    main()
