import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { useUIStore } from "@/store/useUIStore";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useDatabases } from "@/hooks/useDatabase";
import { createDatabase, executeQuery } from "@/lib/api";

type Mode = "create" | "open" | "sql";

export function ImportDialog() {
  const open = useUIStore((s) => s.importOpen);
  const setOpen = useUIStore((s) => s.setImportOpen);
  const setActive = useDatabaseStore((s) => s.setActive);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [createPath, setCreatePath] = useState("");
  const [openPath, setOpenPath] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [sqlTargetPath, setSqlTargetPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const dbsQuery = useDatabases();

  function reset() {
    setName("");
    setCreatePath("");
    setOpenPath("");
    setSqlText("");
    setSqlTargetPath("");
    setProgress(null);
  }

  async function handleCreate() {
    const path = createPath.trim();
    const nm = name.trim();
    if (!path) {
      toast.error("Enter a file path for the new database");
      return;
    }
    if (!nm) {
      toast.error("Enter a database name");
      return;
    }
    setBusy(true);
    setProgress(null);
    try {
      await createDatabase({ action: "create", path, name: nm });
      toast.success("Database created");
      setActive(path);
      await dbsQuery.refetch();
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create database");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen() {
    const path = openPath.trim();
    if (!path) {
      toast.error("Enter the absolute path to the database file");
      return;
    }
    setBusy(true);
    setProgress(null);
    try {
      await createDatabase({ action: "open", path });
      toast.success("Database opened");
      setActive(path);
      await dbsQuery.refetch();
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to open database");
    } finally {
      setBusy(false);
    }
  }

  function onSqlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSqlText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Failed to read SQL file");
    reader.readAsText(file);
  }

  async function handleImportSql() {
    const target = sqlTargetPath.trim();
    if (!target) {
      toast.error("Enter a path for the database to import into");
      return;
    }
    const text = sqlText.trim();
    if (!text) {
      toast.error("Paste SQL or select a .sql file first");
      return;
    }
    setBusy(true);
    setProgress("Preparing database…");
    try {
      // Ensure the target database exists/opened.
      try {
        await createDatabase({ action: "open", path: target });
      } catch {
        await createDatabase({ action: "create", path: target, name: target.split("/").pop() ?? "import" });
      }
      setActive(target);

      // Split into statements and execute each.
      const statements = text
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let ok = 0;
      let failed = 0;
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        setProgress(`Executing ${i + 1}/${statements.length}…`);
        try {
          const res = await executeQuery(target, stmt);
          if (res.results.length > 0 && !res.results[0].success) {
            failed++;
          } else {
            ok++;
          }
        } catch {
          failed++;
        }
      }
      await dbsQuery.refetch();
      if (failed === 0) {
        toast.success(`Imported ${ok} statements`);
      } else {
        toast.success(`Imported ${ok} statements (${failed} failed)`);
      }
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "SQL import failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Database</DialogTitle>
          <DialogDescription>Create a new database, open an existing one, or import a SQL dump.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="mb-3">
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="open">Open Existing</TabsTrigger>
            <TabsTrigger value="sql">Import SQL</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Database name</label>
                <Input
                  placeholder="e.g. mydb"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">File path</label>
                <Input
                  placeholder="e.g. /tmp/mydb.db"
                  value={createPath}
                  onChange={(e) => setCreatePath(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter an absolute file path where the new SQLite database will be created on the server.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="open">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Absolute path to database file</label>
                <Input
                  placeholder="e.g. /home/user/data.db"
                  value={openPath}
                  onChange={(e) => setOpenPath(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Enter the absolute path to an existing .db / .db3 / .sqlite file on the server.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="sql">
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Target database path</label>
                <Input
                  placeholder="e.g. /tmp/imported.db"
                  value={sqlTargetPath}
                  onChange={(e) => setSqlTargetPath(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">SQL dump</label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 gap-1"
                  >
                    <Upload className="h-3.5 w-3.5" /> Select .sql file
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt"
                    className="hidden"
                    onChange={onSqlFile}
                  />
                </div>
              </div>
              <Textarea
                placeholder="Paste SQL statements here…"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
              {progress && <p className="text-[11px] text-muted-foreground">{progress}</p>}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          {mode === "create" && (
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
            </Button>
          )}
          {mode === "open" && (
            <Button onClick={handleOpen} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Open
            </Button>
          )}
          {mode === "sql" && (
            <Button onClick={handleImportSql} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}