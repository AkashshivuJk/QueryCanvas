import { useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { sql, type SQLNamespace } from "@codemirror/lang-sql";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Play, Gauge, Wand2, Undo2, Redo2, Save, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useQueryStore } from "@/store/useQueryStore";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useUndo, useRedo } from "@/hooks/useDatabase";
import { formatSql } from "@/features/sql/formatter";
import { toast } from "@/components/ui/toast";

interface SqlEditorProps {
  onRun: () => void;
  onExplain: () => void;
  onSaveQuery: () => void;
}

export function SqlEditor({ onRun, onExplain, onSaveQuery }: SqlEditorProps) {
  const currentSql = useQueryStore((s) => s.currentSql);
  const setCurrentSql = useQueryStore((s) => s.setCurrentSql);
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const metadata = useDatabaseStore((s) => s.metadata);
  const undoMut = useUndo();
  const redoMut = useRedo();

  // Build the schema namespace for autocomplete: { tableName: [column, ...] }.
  const schemaNamespace = useMemo<SQLNamespace>(() => {
    const tables: SQLNamespace = {};
    if (metadata) {
      for (const schema of metadata.schemas) {
        for (const table of schema.tables) {
          tables[table.name] = table.columns.map((c) => c.name);
        }
      }
    }
    return tables;
  }, [metadata]);

  const extensions = useMemo(
    () => [
      EditorView.lineWrapping,
      keymap.of([{ key: "Ctrl-Enter", run: () => { onRun(); return true; } }]),
      sql({ schema: schemaNamespace, upperCaseKeywords: true }),
    ],
    [schemaNamespace, onRun],
  );

  // Global keyboard shortcut events (window CustomEvents from useKeyboardShortcuts).
  useEffect(() => {
    function onRunEvent() {
      onRun();
    }
    function onSaveEvent() {
      onSaveQuery();
    }
    function onUndoEvent() {
      if (activeDbPath) {
        undoMut.mutate(activeDbPath, {
          onSuccess: (res) => {
            if (res.success) toast.success("Undo applied");
            else toast.error(res.error || "Undo failed");
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Undo failed"),
        });
      }
    }
    function onRedoEvent() {
      if (activeDbPath) {
        redoMut.mutate(activeDbPath, {
          onSuccess: (res) => {
            if (res.success) toast.success("Redo applied");
            else toast.error(res.error || "Redo failed");
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Redo failed"),
        });
      }
    }
    window.addEventListener("dvws:run-query", onRunEvent);
    window.addEventListener("dvws:save-query", onSaveEvent);
    window.addEventListener("dvws:undo", onUndoEvent);
    window.addEventListener("dvws:redo", onRedoEvent);
    return () => {
      window.removeEventListener("dvws:run-query", onRunEvent);
      window.removeEventListener("dvws:save-query", onSaveEvent);
      window.removeEventListener("dvws:undo", onUndoEvent);
      window.removeEventListener("dvws:redo", onRedoEvent);
    };
  }, [onRun, onSaveQuery, activeDbPath, undoMut, redoMut]);

  function handleFormat() {
    const formatted = formatSql(currentSql);
    if (formatted) setCurrentSql(formatted);
  }

  function handleUndo() {
    if (activeDbPath) {
      undoMut.mutate(activeDbPath, {
        onSuccess: (res) => {
          if (res.success) toast.success("Undo applied");
          else toast.error(res.error || "Undo failed");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Undo failed"),
      });
    }
  }

  function handleRedo() {
    if (activeDbPath) {
      redoMut.mutate(activeDbPath, {
        onSuccess: (res) => {
          if (res.success) toast.success("Redo applied");
          else toast.error(res.error || "Redo failed");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Redo failed"),
      });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <Tooltip content="Run (Ctrl+Enter)">
          <Button size="icon" variant="default" className="h-7 w-7" onClick={onRun} disabled={!activeDbPath}>
            <Play className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Explain Query">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onExplain} disabled={!activeDbPath}>
            <Gauge className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Format SQL">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleFormat}>
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Tooltip content="Undo (Ctrl+Z)">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUndo} disabled={!activeDbPath}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Shift+Z)">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleRedo} disabled={!activeDbPath}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Tooltip content="Save Query (Ctrl+S)">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSaveQuery} disabled={!activeDbPath}>
            <Save className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Clear Editor">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCurrentSql("")}>
            <Eraser className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden text-sm">
        <CodeMirror
          value={currentSql}
          height="100%"
          theme={vscodeDark}
          extensions={extensions}
          onChange={(val) => setCurrentSql(val)}
          basicSetup={{ highlightActiveLine: true, bracketMatching: true, autocompletion: true }}
          placeholder="-- Enter SQL and press Ctrl+Enter to run"
          style={{ height: "100%", fontSize: "13px" }}
        />
      </div>
    </div>
  );
}