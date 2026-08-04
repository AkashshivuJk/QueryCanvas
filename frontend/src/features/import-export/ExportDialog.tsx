import { useState } from "react";
import { FileImage, FileJson, FileText, FileType, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useUIStore } from "@/store/useUIStore";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { fetchExport } from "@/lib/api";
import { downloadBlob } from "@/lib/utils";

type ExportFormat = "png" | "svg" | "pdf" | "json" | "sql";

interface FormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  filename: (path: string) => string;
}

const FORMATS: FormatOption[] = [
  { format: "png", label: "PNG", description: "Raster image of the schema", icon: <FileImage className="h-5 w-5" />, filename: (p) => `${deriveName(p)}.png` },
  { format: "svg", label: "SVG", description: "Scalable vector of the schema", icon: <FileType className="h-5 w-5" />, filename: (p) => `${deriveName(p)}.svg` },
  { format: "pdf", label: "PDF", description: "Printable schema document", icon: <FileText className="h-5 w-5" />, filename: (p) => `${deriveName(p)}.pdf` },
  { format: "json", label: "JSON", description: "Schema metadata as JSON", icon: <FileJson className="h-5 w-5" />, filename: (p) => `${deriveName(p)}.json` },
  { format: "sql", label: "SQL", description: "Full SQL schema dump", icon: <FileText className="h-5 w-5" />, filename: (p) => `${deriveName(p)}.sql` },
];

function deriveName(path: string): string {
  const base = path.split("/").pop() ?? "schema";
  return base.replace(/\.(db|db3|sqlite|sql)$/i, "") || "schema";
}

export function ExportDialog() {
  const open = useUIStore((s) => s.exportOpen);
  const setOpen = useUIStore((s) => s.setExportOpen);
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function handleExport(opt: FormatOption) {
    if (!activeDbPath) {
      toast.error("No database selected");
      return;
    }
    setBusy(opt.format);
    try {
      const blob = await fetchExport(activeDbPath, opt.format);
      const url = URL.createObjectURL(blob);
      downloadBlob(url, opt.filename(activeDbPath));
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success(`Exported ${opt.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Export ${opt.label} failed`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open && !!activeDbPath} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>Download the schema or data in the chosen format.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FORMATS.map((opt) => (
            <button
              key={opt.format}
              onClick={() => handleExport(opt)}
              disabled={busy !== null}
              className="flex items-center gap-3 rounded-md border border-border bg-background p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              <span className="shrink-0 text-muted-foreground">{opt.icon}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {opt.label}
                  {busy === opt.format && <Loader2 className="h-3 w-3 animate-spin" />}
                </span>
                <span className="block text-xs text-muted-foreground">{opt.description}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}