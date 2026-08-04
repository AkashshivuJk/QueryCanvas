// A small, reasonable SQL formatter. Uppercases keywords and puts major
// clauses on their own lines with indentation. Not perfect — good enough
// for a workspace "Format" button.

const CLAUSE_KEYWORDS = [
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "VALUES",
  "SET",
  "WHERE",
  "FROM",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "LEFT OUTER JOIN",
  "RIGHT OUTER JOIN",
  "FULL OUTER JOIN",
  "CROSS JOIN",
  "JOIN",
  "ON",
  "UNION",
  "UNION ALL",
  "INTERSECT",
  "EXCEPT",
];

const UPPERCASE_KEYWORDS = [
  "SELECT",
  "DISTINCT",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "NOT",
  "NULL",
  "IS",
  "IN",
  "LIKE",
  "BETWEEN",
  "EXISTS",
  "AS",
  "ASC",
  "DESC",
  "INSERT INTO",
  "INSERT",
  "INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "DELETE",
  "CREATE TABLE",
  "CREATE INDEX",
  "CREATE UNIQUE INDEX",
  "CREATE VIEW",
  "CREATE",
  "DROP TABLE",
  "DROP INDEX",
  "DROP VIEW",
  "DROP",
  "ALTER TABLE",
  "ALTER",
  "ADD",
  "RENAME",
  "TO",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "JOIN",
  "INNER JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "FULL JOIN",
  "LEFT OUTER JOIN",
  "RIGHT OUTER JOIN",
  "FULL OUTER JOIN",
  "CROSS JOIN",
  "ON",
  "UNION",
  "UNION ALL",
  "INTERSECT",
  "EXCEPT",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "WITH",
  "RECURSIVE",
  "PRIMARY KEY",
  "FOREIGN KEY",
  "REFERENCES",
  "UNIQUE",
  "CHECK",
  "DEFAULT",
  "AUTOINCREMENT",
  "TEMPORARY",
  "IF EXISTS",
  "IF NOT EXISTS",
  "INTEGER",
  "TEXT",
  "REAL",
  "BLOB",
  "NUMERIC",
  "VARCHAR",
  "BOOLEAN",
  "DATE",
  "DATETIME",
  "TIMESTAMP",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Uppercase SQL keywords within a fragment, preserving quoted identifiers/literals. */
function uppercaseKeywords(sql: string): string {
  let result = "";
  let i = 0;
  const isQuote = (c: string) => c === "'" || c === '"' || c === "`";
  while (i < sql.length) {
    const c = sql[i];
    if (isQuote(c)) {
      // consume quoted run
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c) {
          // handle doubled-quote escape
          if (sql[j + 1] === c) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      result += sql.slice(i, j);
      i = j;
      continue;
    }
    // match longest keyword at this position (word-boundary aware)
    let matched = false;
    for (const kw of UPPERCASE_KEYWORDS) {
      const re = new RegExp(`^${escapeRegex(kw)}(?![A-Za-z0-9_])`, "i");
      const m = re.exec(sql.slice(i));
      if (m) {
        result += kw.toUpperCase();
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    result += c;
    i += 1;
  }
  return result;
}

/** Split a statement into (leadingClause, rest) at the first major clause boundary. */
function splitOnClause(sql: string): { clause: string; rest: string } | null {
  // search for the first clause keyword that appears as a standalone token
  // (preceded by whitespace or start, not inside quotes).
  let inQuote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inQuote = c;
      continue;
    }
    if (/\s/.test(c) || i === 0) {
      const slice = sql.slice(i).trimStart();
      for (const kw of CLAUSE_KEYWORDS) {
        const re = new RegExp(`^${escapeRegex(kw)}(?![A-Za-z0-9_])`, "i");
        if (re.test(slice)) {
          return { clause: kw.toUpperCase(), rest: sql.slice(i) };
        }
      }
    }
  }
  return null;
}

export function formatSql(input: string): string {
  if (!input.trim()) return "";
  // Normalize whitespace first.
  let sql = input.trim().replace(/\s+/g, " ").trim();

  // Split into statements on semicolons (top-level only, respecting quotes).
  const statements: string[] = [];
  let buf = "";
  let inQuote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inQuote) {
      buf += c;
      if (c === inQuote) inQuote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inQuote = c;
      buf += c;
      continue;
    }
    if (c === ";") {
      statements.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) statements.push(buf.trim());

  const formatted = statements.map((stmt) => formatSingleStatement(stmt));
  return formatted.join(";\n\n") + (formatted.length > 0 ? ";" : "");
}

function formatSingleStatement(stmt: string): string {
  let s = uppercaseKeywords(stmt).trim();
  if (!s) return "";

  const lines: string[] = [];
  // Pull the leading clause (SELECT / INSERT / UPDATE / DELETE / CREATE / DROP / ALTER / WITH).
  // Then break on each subsequent major clause.
  let indent = 0;
  let current = s;

  // First line: take up to the first major sub-clause.
  const firstSplit = splitOnClauseRest(current);
  if (firstSplit) {
    lines.push(firstSplit.head.trim());
    current = firstSplit.tail;
  } else {
    lines.push(current.trim());
    current = "";
  }

  while (current.trim()) {
    const sp = splitOnClause(current);
    if (!sp) {
      lines.push("  ".repeat(indent) + current.trim());
      break;
    }
    const before = current.slice(0, current.length - sp.rest.length).trim();
    const clauseText = sp.clause;
    const after = sp.rest.slice(clauseText.length).trim();
    if (before) {
      lines.push("  ".repeat(indent) + before);
    }
    // next clause starts a new line; some clauses bump indentation.
    const nextLine = clauseText + (after ? " " + after : "");
    // indent joins under FROM
    if (/JOIN$/.test(clauseText)) {
      indent = 1;
    }
    lines.push("  ".repeat(indent) + nextLine);
    current = "";
  }

  return lines.join("\n");
}

/** Split a statement into the head (first clause + its immediate body) and the tail (rest). */
function splitOnClauseRest(sql: string): { head: string; tail: string } | null {
  // find the first sub-clause keyword after the leading keyword.
  let inQuote: string | null = null;
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inQuote) {
      if (c === inQuote) inQuote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      inQuote = c;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth > 0) continue;
    if (i > 0 && /\s/.test(c)) {
      const slice = sql.slice(i).trimStart();
      for (const kw of CLAUSE_KEYWORDS) {
        const re = new RegExp(`^${escapeRegex(kw)}(?![A-Za-z0-9_])`, "i");
        if (re.test(slice)) {
          return { head: sql.slice(0, i), tail: sql.slice(i) };
        }
      }
    }
  }
  return null;
}