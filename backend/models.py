"""Pydantic v2 request/response models for the API."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# --- Databases -------------------------------------------------------------


class DatabaseCreateRequest(BaseModel):
    path: Optional[str] = None
    action: str  # 'create' | 'open'
    name: Optional[str] = None


class DatabaseInfo(BaseModel):
    path: str
    name: str
    size_bytes: int
    backend: str = "sqlite"


class CellEditRequest(BaseModel):
    path: str
    table: str
    rowid: int
    column: str
    value: Any  # str | number | None


# --- Query ------------------------------------------------------------------


class QueryRequest(BaseModel):
    path: str
    sql: str


class QueryResult(BaseModel):
    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    affected_rows: int = 0
    execution_time_ms: float = 0.0
    success: bool = True
    error: Optional[str] = None
    statement_type: str = "UNKNOWN"
    schema_changed: bool = False


class MultiQueryResult(BaseModel):
    results: list[QueryResult] = Field(default_factory=list)
    total: int = 0
    any_schema_changed: bool = False


class ExplainPlanRow(BaseModel):
    id: int
    parent: int
    notused: int
    detail: str


class ExplainResult(BaseModel):
    plan: list[ExplainPlanRow] = Field(default_factory=list)
    estimated_cost: int = 0
    indexes_used: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    potential_problems: list[str] = Field(default_factory=list)


# --- History ----------------------------------------------------------------


class FavoriteRequest(BaseModel):
    path: str
    history_id: str
    favorite: bool


class SavedQueryCreate(BaseModel):
    path: str
    name: str
    sql: str


class SavedQuery(BaseModel):
    id: str
    name: str
    sql: str
    created_at: str


class HistoryEntry(BaseModel):
    id: str
    sql: str
    timestamp: str
    execution_time_ms: float
    affected_rows: int
    success: bool
    error: Optional[str] = None
    favorite: bool = False
    statement_type: str = "UNKNOWN"


class UndoRedoEntry(BaseModel):
    sql: str
    inverse_sql: str
    timestamp: str
    op_type: str


class HistoryResponse(BaseModel):
    execution: list[HistoryEntry] = Field(default_factory=list)
    undo_stack: list[UndoRedoEntry] = Field(default_factory=list)
    redo_stack: list[UndoRedoEntry] = Field(default_factory=list)


class UndoRedoResult(BaseModel):
    success: bool
    sql_executed: str
    metadata_changed: bool = False
    error: Optional[str] = None


# --- Recommendations --------------------------------------------------------


class Recommendation(BaseModel):
    id: str
    title: str
    description: str
    sql: str
    category: str  # overview | data_quality | performance | relationships | examples