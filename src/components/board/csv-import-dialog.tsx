"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createEpic, createTasksBulk } from "@/app/projects/[id]/actions";
import type { ColumnRow } from "@/app/projects/[id]/board";
import type { EpicRow } from "./task-card";
import { parseCsvTasks, type CsvTask } from "@/lib/utils/csv";
import { EPIC_COLORS } from "@/lib/utils/epic-color";

export function CsvImportDialog({
  projectId,
  columns,
  epics,
  trigger,
}: {
  projectId: string;
  columns: ColumnRow[];
  epics: EpicRow[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvTask[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [createMissing, setCreateMissing] = useState(true);
  const [pending, startTransition] = useTransition();

  const firstColumn = columns[0];

  const epicByName = useMemo(() => {
    const m = new Map<string, EpicRow>();
    for (const e of epics) m.set(e.name.trim().toLowerCase(), e);
    return m;
  }, [epics]);

  const { matched, unmatched } = useMemo(() => {
    const set = new Set<string>();
    const unmatchedSet = new Set<string>();
    for (const r of rows) {
      const name = r.epic?.trim();
      if (!name) continue;
      if (epicByName.has(name.toLowerCase())) set.add(name);
      else unmatchedSet.add(name);
    }
    return { matched: [...set], unmatched: [...unmatchedSet] };
  }, [rows, epicByName]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCsvTasks(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error("No valid rows in CSV");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstColumn) return toast.error("No columns on this board");
    if (rows.length === 0) return toast.error("Load a CSV first");

    startTransition(async () => {
      let resolved = new Map(epicByName);

      if (createMissing && unmatched.length > 0) {
        for (let i = 0; i < unmatched.length; i++) {
          const name = unmatched[i];
          const color = EPIC_COLORS[i % EPIC_COLORS.length];
          const res = await createEpic(projectId, name, color);
          if (!res.ok) {
            toast.error(`Failed to create epic "${name}": ${res.error}`);
            return;
          }
        }
        // Re-fetch not possible client-side cheaply; rely on revalidatePath + props re-sync.
        // For the bulk insert, we still need epic IDs now. Pass epic name as fallback key
        // and let the next render pick them up. Since server just got them, do a quick map.
        // Simpler: pass the parsed rows with epic name; we'll resolve AFTER the next revalidate cycle.
        // But createTasksBulk needs epic_id up-front. Workaround: fetch fresh epics via the browser client.
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: fresh } = await supabase
          .from("epics")
          .select("id, name, color")
          .eq("project_id", projectId);
        resolved = new Map();
        for (const ep of fresh ?? [])
          resolved.set((ep.name as string).trim().toLowerCase(), ep as EpicRow);
      }

      const payload = rows.map((r) => {
        const epicName = r.epic?.trim().toLowerCase();
        const epic_id = epicName ? resolved.get(epicName)?.id ?? null : null;
        return {
          title: r.title,
          description: r.description ?? null,
          priority: r.priority,
          label: r.label ?? null,
          epic_id,
        };
      });

      const res = await createTasksBulk(projectId, firstColumn.id, payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      const missingCount =
        !createMissing && unmatched.length > 0 ? ` (${unmatched.length} epic name${unmatched.length === 1 ? "" : "s"} ignored)` : "";
      toast.success(`Imported ${rows.length} task${rows.length === 1 ? "" : "s"}${missingCount}`);
      setOpen(false);
      setRows([]);
      setFileName("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Headers: <code>title</code> (required), <code>description</code>,{" "}
            <code>priority</code> (low|medium|high), <code>label</code>, <code>epic</code>.
            {firstColumn && (
              <>
                {" "}Tasks are added to <strong>{firstColumn.name}</strong>.
              </>
            )}
          </p>

          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={onFile}
              className="block w-full text-sm file:mr-3 file:rounded file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:hover:bg-neutral-50"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                {fileName} — {rows.length} row{rows.length === 1 ? "" : "s"} ready
              </p>
            )}
          </div>

          {rows.length > 0 && (matched.length > 0 || unmatched.length > 0) && (
            <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
              {matched.length > 0 && (
                <p>
                  <span className="font-medium">Matched epics:</span> {matched.join(", ")}
                </p>
              )}
              {unmatched.length > 0 && (
                <>
                  <p>
                    <span className="font-medium text-amber-700">New epic name{unmatched.length === 1 ? "" : "s"}:</span>{" "}
                    {unmatched.join(", ")}
                  </p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createMissing}
                      onChange={(e) => setCreateMissing(e.target.checked)}
                    />
                    <span>Create missing epics automatically</span>
                  </label>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || rows.length === 0 || !firstColumn}>
              {pending ? "Importing..." : `Import ${rows.length || ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
