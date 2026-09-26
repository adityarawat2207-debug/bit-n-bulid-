"""AI explanation layer (PRD §35-36, §52).

The engine decides; this module only explains the engine's /incident JSON.
A deterministic template is always available. If GROQ_API_KEY (preferred) or
ANTHROPIC_API_KEY is set, an LLM rewrites it, but its answer is thrown away (template used instead) when
it errors, takes longer than 8s, or states any number not in the input."""
import json
import os
import re

import httpx

LLM_URL = "https://api.anthropic.com/v1/messages"
LLM_MODEL = os.environ.get("CLOUDPULSE_LLM_MODEL", "claude-haiku-4-5-20251001")
LLM_TIMEOUT_S = 8.0
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("CLOUDPULSE_GROQ_MODEL", "openai/gpt-oss-120b")

SYSTEM_PROMPT = """You are CloudPulse's incident explanation engine.

You must explain incidents using only the structured
analysis supplied by the application.

Never invent:
- costs
- metrics
- services
- dependencies
- recommendations based on unsupported evidence

Never claim certainty when the root cause is uncertain.

Use phrases such as:
"likely root cause"
"estimated impact"
"supporting evidence"

Keep explanations concise and technical.

Use only the provided structured evidence. Never introduce unsupported numerical values.

Reply with only a JSON object with these keys:
{"summary": "", "root_cause_explanation": "", "evidence": [], "recommendation_explanation": ""}"""


def _when(ts):
    return f"{ts[:10]} {ts[11:16]} UTC"


def template(inc):
    i, rc, recs = inc["incident"], inc["root_cause"], inc["recommendations"]
    path = [f"{e['source']} -> {e['target']}" for e in inc["graph"]["edges"] if e["on_propagation_path"]]
    alt = inc["candidates"][0] if inc["candidates"] else None
    good = next((r for r in recs if r["verdict"] == "RECOMMENDED"), None)
    bad = recs[-1] if recs and recs[-1]["verdict"] == "NOT RECOMMENDED" else None

    summary = (f"Cloud cost is running {i['cost_change_pct']}% above its baseline ({i['severity']} severity). "
               f"The increase began at {_when(i['onset_at'])} and was detected at {_when(i['detected_at'])}.")
    root = (f"The likely root cause is {rc['service']} (root-cause confidence {round(rc['confidence'] * 100)}%). "
            f"Its own behaviour changed, and the extra load spread along {', '.join(path) or 'no downstream edges'}.")
    if alt:
        root += (f" The next candidate, {alt['service']} ({round(alt['confidence'] * 100)}%), "
                 f"was ruled out: {alt['why_not'][0].lower() + alt['why_not'][1:]}.")
    impact = inc["impact"]["by_cause"]
    if impact:
        root += f" Estimated impact traced to {impact[0]['service']}: ${impact[0]['amount']:,}/month."

    rec = ""
    if good:
        rec = (f"Recommended: {good['title']}. Estimated saving ${good['savings_monthly']:,}/month, "
               f"latency {good['latency_pct']:+}%, error rate {good['error_pp']:+}pp, risk {good['risk']}.")
    if bad:
        rec += f" Not recommended: {bad['title']}, because {'; '.join(bad['reasons'])}."
    return dict(summary=summary, root_cause_explanation=root, evidence=list(rc["evidence"]),
                recommendation_explanation=rec.strip())


# ------------------------------------------------------------ number guard
_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _numbers(text):
    out = set()
    for m in _NUM.findall(text):
        try:
            out.add(float(m.replace(",", "")))
        except ValueError:
            pass
    return out


def _allowed(inc):
    allowed = set(range(11))  # list numbering, "one of 3", etc.
    for x in _numbers(json.dumps(inc)):
        variants = [x, round(x), round(x, 1), round(x, 2)]
        if x <= 1:  # fractions shown as percentages
            variants += [round(x * 100), round(x * 100, 1)]
        allowed.update(float(v) for v in variants)
    return allowed


def unsupported_numbers(text, inc):
    allowed = _allowed(inc)
    return sorted(n for n in _numbers(text) if n not in allowed and round(n, 1) not in allowed)


def _join(sections):
    return "\n\n".join([sections["summary"], sections["root_cause_explanation"],
                        "Supporting evidence:\n" + "\n".join(f"- {e}" for e in sections["evidence"]),
                        sections["recommendation_explanation"]])


def _call_anthropic(user, key):
    resp = httpx.post(LLM_URL, timeout=LLM_TIMEOUT_S, headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json=dict(model=LLM_MODEL, max_tokens=800, system=SYSTEM_PROMPT,
                  messages=[dict(role="user", content=user)]))
    resp.raise_for_status()
    return "".join(b.get("text", "") for b in resp.json()["content"])


def _call_groq(user, key):
    resp = httpx.post(GROQ_URL, timeout=LLM_TIMEOUT_S, headers={"authorization": f"Bearer {key}"},
                      json=dict(model=GROQ_MODEL, max_tokens=1500, temperature=0.2, reasoning_effort="low",
                                response_format={"type": "json_object"},
                                messages=[dict(role="system", content=SYSTEM_PROMPT),
                                          dict(role="user", content=user)]))
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _provider():
    if os.environ.get("GROQ_API_KEY"):
        return _call_groq, os.environ["GROQ_API_KEY"]
    if os.environ.get("ANTHROPIC_API_KEY"):
        return _call_anthropic, os.environ["ANTHROPIC_API_KEY"]
    return None, None


def _llm(inc, call, key):
    payload = dict(incident=inc["incident"], root_cause=inc["root_cause"], candidates=inc["candidates"][:3],
                   propagation=[e for e in inc["graph"]["edges"] if e["on_propagation_path"]],
                   estimated_impact=inc["impact"], recommendations=inc["recommendations"])
    text = call(json.dumps(payload), key)
    out = json.loads(text[text.index("{"):text.rindex("}") + 1])
    keys = ("summary", "root_cause_explanation", "evidence", "recommendation_explanation")
    if not all(k in out for k in keys) or not isinstance(out["evidence"], list):
        raise ValueError("LLM reply is missing keys")
    return {k: out[k] for k in keys}


def explain(inc):
    """Return {text, source, sections} for an /incident response."""
    if inc.get("incident") is None:
        s = dict(summary="No active cost incident. Spend is within its normal range.",
                 root_cause_explanation="", evidence=[], recommendation_explanation="")
        return dict(text=s["summary"], source="template", sections=s)
    call, key = _provider()
    if call:
        try:
            s = _llm(inc, call, key)
            if not unsupported_numbers(_join(s), inc):
                return dict(text=_join(s), source="llm", sections=s)
        except Exception:  # timeout, HTTP error, bad JSON: the template is the fallback
            pass
    s = template(inc)
    return dict(text=_join(s), source="template", sections=s)
