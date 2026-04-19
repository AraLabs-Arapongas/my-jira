"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateTask, deleteTask } from "@/app/projects/[id]/actions";
import type { EpicRow, TaskRow } from "./task-card";
import { epicTone } from "@/lib/utils/epic-color";

const NO_EPIC = "__none__";

export function TaskDialog({
  projectId,
  task,
  epics,
  open,
  onOpenChange,
}: {
  projectId: string;
  task: TaskRow;
  epics: EpicRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskRow["priority"]>(task.priority);
  const [label, setLabel] = useState(task.label ?? "");
  const [epicId, setEpicId] = useState<string>(task.epic_id ?? NO_EPIC);
  const [pending, startTransition] = useTransition();

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateTask(projectId, task.id, {
        title,
        description,
        priority,
        label,
        epic_id: epicId === NO_EPIC ? null : epicId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOpenChange(false);
    });
  }

  function onDelete() {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    startTransition(async () => {
      const res = await deleteTask(projectId, task.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority((v ?? "medium") as TaskRow["priority"])}>
                <SelectTrigger id="t-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-label">Label</Label>
              <Input id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. bug" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-epic">Epic</Label>
            <Select value={epicId} onValueChange={(v) => setEpicId(v ?? NO_EPIC)}>
              <SelectTrigger id="t-epic"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EPIC}>— None —</SelectItem>
                {epics.map((e) => {
                  const t = epicTone(e.color);
                  return (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: t.dot }}
                        />
                        {e.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button type="button" variant="destructive" onClick={onDelete} disabled={pending}>
              Delete
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
