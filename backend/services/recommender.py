"""Schema-driven SQL recommendation generator."""
from __future__ import annotations

import re
from typing import Any


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def generate_recommendations(metadata: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate recommendation dicts from a metadata structure."""
    recs: list[dict[str, Any]] = []
    schema = metadata.get("schemas", [{}])[0] if metadata.get("schemas") else {}
    tables = schema.get("tables", [])
    table_names = [t["name"] for t in tables if t.get("type") == "table"]

    if not table_names:
        recs.append(
            {
                "id": "no-tables",
                "title": "No tables found",
                "description": "The database has no tables yet. Create one to begin.",
                "sql": "CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT);",
                "category": "overview",
            }
        )
        return recs

    # 1. Show all tables
    recs.append(
        {
            "id": "show-all-tables",
            "title": "Show all tables",
            "description": "List every table in the database.",
            "sql": "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;",
            "category": "overview",
        }
    )

    # 2. Count rows per table
    count_sql = " UNION ALL ".join(
        f"SELECT '{t}' AS table_name, COUNT(*) AS row_count FROM {_quote_ident(t)}"
        for t in table_names
    )
    recs.append(
        {
            "id": "count-rows-all-tables",
            "title": "Count rows in every table",
            "description": "Return a row count for each table to spot empty or huge ones.",
            "sql": count_sql + ";",
            "category": "overview",
        }
    )

    for t in tables:
        tname = t["name"]
        cols = t.get("columns", [])
        non_pk = [c for c in cols if not c.get("is_pk")]
        # 3. Duplicate values (first non-pk column)
        if non_pk:
            col = non_pk[0]["name"]
            recs.append(
                {
                    "id": f"duplicates-{tname}-{col}",
                    "title": f"Find duplicate values in {tname}.{col}",
                    "description": (
                        f"Rows sharing the same {col} value may indicate bad data."
                    ),
                    "sql": (
                        f"SELECT {_quote_ident(col)}, COUNT(*) AS n "
                        f"FROM {_quote_ident(tname)} "
                        f"GROUP BY {_quote_ident(col)} HAVING COUNT(*) > 1 "
                        f"ORDER BY n DESC;"
                    ),
                    "category": "data_quality",
                }
            )

        # 11. Index suggestion (first column, if not PK)
        if cols and not cols[0].get("is_pk"):
            col = cols[0]["name"]
            recs.append(
                {
                    "id": f"index-suggest-{tname}-{col}",
                    "title": f"Add an index on {tname}.{col}",
                    "description": (
                        f"Filters on {col} would benefit from an index."
                    ),
                    "sql": (
                        f"CREATE INDEX idx_{tname}_{col} "
                        f"ON {_quote_ident(tname)}({_quote_ident(col)});"
                    ),
                    "category": "performance",
                }
            )

        # 10. Window function example using PK
        pk = next((c["name"] for c in cols if c.get("is_pk")), None)
        if pk:
            recs.append(
                {
                    "id": f"window-{tname}",
                    "title": f"Row numbers for {tname}",
                    "description": (
                        "Window function ranking rows by the primary key."
                    ),
                    "sql": (
                        f"SELECT {_quote_ident(pk)}, ROW_NUMBER() OVER "
                        f"(ORDER BY {_quote_ident(pk)}) AS rn "
                        f"FROM {_quote_ident(tname)};"
                    ),
                    "category": "examples",
                }
            )

        # 9. GROUP BY example (first column)
        if cols:
            col = cols[0]["name"]
            recs.append(
                {
                    "id": f"groupby-{tname}-{col}",
                    "title": f"Group {tname} by {col}",
                    "description": "Count rows per distinct value of the first column.",
                    "sql": (
                        f"SELECT {_quote_ident(col)}, COUNT(*) AS n "
                        f"FROM {_quote_ident(tname)} GROUP BY {_quote_ident(col)} "
                        f"ORDER BY n DESC;"
                    ),
                    "category": "examples",
                }
            )

    # 4. Missing foreign keys
    no_fk = [
        t["name"]
        for t in tables
        if not t.get("foreign_keys") and t.get("type") == "table"
    ]
    if no_fk:
        names = ", ".join(_quote_ident(n) for n in no_fk)
        recs.append(
            {
                "id": "missing-foreign-keys",
                "title": "Tables without foreign keys",
                "description": (
                    "These tables have no foreign key defined, which may indicate "
                    "denormalized data: " + names + "."
                ),
                "sql": (
                    "SELECT name FROM sqlite_master WHERE type = 'table' "
                    "AND name IN (" + ", ".join("'" + n + "'" for n in no_fk) + ") "
                    "ORDER BY name;"
                ),
                "category": "relationships",
            }
        )

    # 5. Unused tables (row_count == 0)
    empty = [t["name"] for t in tables if t.get("row_count", 0) == 0]
    if empty:
        recs.append(
            {
                "id": "unused-tables",
                "title": "Empty tables",
                "description": "These tables have zero rows and may be unused.",
                "sql": (
                    "SELECT name FROM sqlite_master WHERE type = 'table' "
                    "AND name IN (" + ", ".join("'" + n + "'" for n in empty) + ") "
                    "ORDER BY name;"
                ),
                "category": "data_quality",
            }
        )

    # 6. Top largest tables
    largest_sql = " UNION ALL ".join(
        f"SELECT '{t['name']}' AS table_name, {t.get('row_count', 0)} AS row_count"
        for t in tables
        if t.get("type") == "table"
    )
    recs.append(
        {
            "id": "largest-tables",
            "title": "Largest tables by row count",
            "description": "Identify the biggest tables to prioritize optimization.",
            "sql": largest_sql + " ORDER BY row_count DESC;" if largest_sql else "",
            "category": "performance",
        }
    )

    # 7. Most connected tables (referenced by most FKs across all tables)
    ref_counts: dict[str, int] = {}
    for t in tables:
        for fk in t.get("foreign_keys", []):
            ref_counts[fk["to_table"]] = ref_counts.get(fk["to_table"], 0) + 1
    if ref_counts:
        most = max(ref_counts, key=lambda k: ref_counts[k])
        recs.append(
            {
                "id": "most-connected-table",
                "title": f"Most connected table: {most}",
                "description": (
                    f"{most} is referenced by {ref_counts[most]} foreign key(s)."
                ),
                "sql": (
                    f"SELECT name FROM sqlite_master WHERE type='table' "
                    f"AND name = '{most}';"
                ),
                "category": "relationships",
            }
        )

    # 8. Generate JOIN query from first FK found
    join_made = False
    for t in tables:
        for fk in t.get("foreign_keys", []):
            child = t["name"]
            parent = fk["to_table"]
            child_col = fk["from_column"]
            parent_col = fk["to_column"]
            recs.append(
                {
                    "id": f"join-{child}-{parent}",
                    "title": f"Join {child} with {parent}",
                    "description": (
                        f"Join on {child}.{child_col} = {parent}.{parent_col}."
                    ),
                    "sql": (
                        f"SELECT * FROM {_quote_ident(child)} JOIN {_quote_ident(parent)} "
                        f"ON {_quote_ident(child)}.{_quote_ident(child_col)} = "
                        f"{_quote_ident(parent)}.{_quote_ident(parent_col)} LIMIT 100;"
                    ),
                    "category": "relationships",
                }
            )
            join_made = True
            break
        if join_made:
            break

    # 12. Normalization suggestion (tables with many columns)
    for t in tables:
        if len(t.get("columns", [])) >= 8:
            tname = t["name"]
            recs.append(
                {
                    "id": f"normalize-{tname}",
                    "title": f"Review normalization of {tname}",
                    "description": (
                        f"{tname} has {len(t.get('columns', []))} columns; "
                        "consider splitting repeating groups into a related table."
                    ),
                    "sql": (
                        f"PRAGMA table_info({_quote_ident(tname)});"
                    ),
                    "category": "data_quality",
                }
            )

    return recs