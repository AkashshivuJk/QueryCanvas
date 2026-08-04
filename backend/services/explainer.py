"""Query plan explainer: parse EXPLAIN QUERY PLAN output, score, suggest."""
from __future__ import annotations

import re
from typing import Any


def explain(plan_rows: list[dict[str, Any]], sql: str = "") -> dict[str, Any]:
    """Build the explain response from EXPLAIN QUERY PLAN rows."""
    plan = [
        {
            "id": r.get("id", 0),
            "parent": r.get("parent", 0),
            "notused": r.get("notused", 0),
            "detail": r.get("detail", ""),
        }
        for r in plan_rows
    ]
    indexes_used: list[str] = []
    suggestions: list[str] = []
    problems: list[str] = []

    # Tables referenced by detail lines.
    tables_in_plan: set[str] = set()

    for r in plan:
        detail = (r["detail"] or "").upper()
        # Index usage.
        m = re.search(r"USING (?:COVERING )?INDEX (.+?)(?:\s|$)", detail)
        if m:
            idx = m.group(1).strip()
            if idx and idx not in indexes_used:
                indexes_used.append(idx)
        elif "SEARCH" in detail or "SCAN" in detail:
            # Extract table name: SEARCH OF <table> / SCAN <table>
            tm = re.search(r"(?:SEARCH|SCAN)\s+(?:TABLE\s+)?\"?([^\s\"]+)\"?", detail)
            if tm:
                tname = tm.group(1)
                tables_in_plan.add(tname)
                if "SCAN" in detail:
                    problems.append(f"Full table scan detected on {tname}.")
                    suggestions.append(
                        f"No index used on table {tname} — consider adding one."
                    )

    estimated_cost = len(plan)

    if not indexes_used and tables_in_plan:
        for t in sorted(tables_in_plan):
            suggestions.append(
                f"Query on {t} did not use an index — consider adding one."
            )

    return {
        "plan": plan,
        "estimated_cost": estimated_cost,
        "indexes_used": indexes_used,
        "suggestions": suggestions,
        "potential_problems": problems,
    }