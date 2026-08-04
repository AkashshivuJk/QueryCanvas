"""UndoRedoManager: per-database undo/redo stacks."""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class HistoryRecord:
    id: str
    sql: str
    timestamp: str
    execution_time_ms: float
    affected_rows: int
    success: bool
    error: Optional[str]
    favorite: bool = False
    statement_type: str = "UNKNOWN"


@dataclass
class UndoRedoEntry:
    id: str
    sql: str
    inverse_sql: str
    timestamp: str
    op_type: str
    affected_rowids: list[int] = field(default_factory=list)


class UndoRedoManager:
    """Maintains undo/redo stacks and execution history for one database."""

    MAX_HISTORY = 200

    def __init__(self) -> None:
        self.undo_stack: list[UndoRedoEntry] = []
        self.redo_stack: list[UndoRedoEntry] = []
        self.execution_history: list[HistoryRecord] = []

    # --- timestamps ---------------------------------------------------------

    @staticmethod
    def _now_iso() -> str:
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    @staticmethod
    def _uuid() -> str:
        return str(uuid.uuid4())

    # --- history ------------------------------------------------------------

    def add_history(
        self,
        sql: str,
        execution_time_ms: float,
        affected_rows: int,
        success: bool,
        error: Optional[str],
        statement_type: str,
    ) -> HistoryRecord:
        rec = HistoryRecord(
            id=self._uuid(),
            sql=sql,
            timestamp=self._now_iso(),
            execution_time_ms=execution_time_ms,
            affected_rows=affected_rows,
            success=success,
            error=error,
            favorite=False,
            statement_type=statement_type,
        )
        self.execution_history.append(rec)
        if len(self.execution_history) > self.MAX_HISTORY:
            self.execution_history = self.execution_history[-self.MAX_HISTORY :]
        return rec

    def toggle_favorite(self, history_id: str, favorite: bool) -> bool:
        for rec in self.execution_history:
            if rec.id == history_id:
                rec.favorite = favorite
                return True
        return False

    def get_history(self, history_id: str) -> Optional[HistoryRecord]:
        for rec in self.execution_history:
            if rec.id == history_id:
                return rec
        return None

    # --- undo/redo ----------------------------------------------------------

    def capture_undo(self, connection, sql: str, op_type: str, inverse_sql: str) -> UndoRedoEntry:
        """Build and push an undo entry. Caller must have captured inverse already."""
        entry = UndoRedoEntry(
            id=self._uuid(),
            sql=sql,
            inverse_sql=inverse_sql,
            timestamp=self._now_iso(),
            op_type=op_type,
            affected_rowids=[],
        )
        self.undo_stack.append(entry)
        # Clear redo stack on new schema-changing action.
        self.redo_stack.clear()
        return entry

    def pop_undo(self) -> Optional[UndoRedoEntry]:
        if not self.undo_stack:
            return None
        return self.undo_stack.pop()

    def push_redo(self, entry: UndoRedoEntry) -> None:
        self.redo_stack.append(entry)

    def pop_redo(self) -> Optional[UndoRedoEntry]:
        if not self.redo_stack:
            return None
        return self.redo_stack.pop()

    def push_undo(self, entry: UndoRedoEntry) -> None:
        self.undo_stack.append(entry)

    def to_history_response(self) -> dict:
        return {
            "execution": [
                {
                    "id": r.id,
                    "sql": r.sql,
                    "timestamp": r.timestamp,
                    "execution_time_ms": r.execution_time_ms,
                    "affected_rows": r.affected_rows,
                    "success": r.success,
                    "error": r.error,
                    "favorite": r.favorite,
                    "statement_type": r.statement_type,
                }
                for r in self.execution_history
            ],
            "undo_stack": [
                {
                    "sql": e.sql,
                    "inverse_sql": e.inverse_sql,
                    "timestamp": e.timestamp,
                    "op_type": e.op_type,
                }
                for e in self.undo_stack
            ],
            "redo_stack": [
                {
                    "sql": e.sql,
                    "inverse_sql": e.inverse_sql,
                    "timestamp": e.timestamp,
                    "op_type": e.op_type,
                }
                for e in self.redo_stack
            ],
        }


# Per-database-path managers.
_managers: dict[str, UndoRedoManager] = {}


def get_undo_manager(path: str) -> UndoRedoManager:
    m = _managers.get(path)
    if m is None:
        m = UndoRedoManager()
        _managers[path] = m
    return m


def remove_undo_manager(path: str) -> None:
    _managers.pop(path, None)