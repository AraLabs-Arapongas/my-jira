"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createEpic, deleteEpic, updateEpic } from "@/app/projects/[id]/actions";
import { EPIC_COLORS, epicTone } from "@/lib/utils/epic-color";
import type { EpicRow } from "./task-card";

export function EpicsDialog({
  projectId,
  epics,
  trigger,
}: {
  projectId: string;
  epics: EpicRow[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("purple");
  const [pending, startTransition] = useTransition();

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createEpic(projectId, newName, newColor);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNewName("");
    });
  }

  function onDelete(id: string, name: string) {
    if (!confirm(`Delete epic "${name}"? Tasks will keep their data but lose the epic.`)) return;
    startTransition(async () => {
      const res = await deleteEpic(projectId, id);
      if (!res.ok) toast.error(res.error);
    });
  }

  function onColorChange(id: string, color: string) {
    startTransition(async () => {
      const res = await updateEpic(projectId, id, { color });
      if (!res.ok) toast.error(res.error);
    });
  }

  function onRename(id: string, name: string) {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await updateEpic(projectId, id, { name });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement}></DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Epics</DialogTitle>
        </DialogHeader>

        <form onSubmit={onCreate} className="space-y-2 border-b pb-4">
          <Label htmlFor="epic-new-name">New epic</Label>
          <div className="flex gap-2">
            <Input
              id="epic-new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Onboarding"
              disabled={pending}
            />
            <ColorSwatches value={newColor} onChange={setNewColor} />
            <Button type="submit" disabled={pending || !newName.trim()}>Add</Button>
          </div>
        </form>

        <div className="max-h-[320px] space-y-2 overflow-y-auto">
          {epics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No epics yet.</p>
          ) : (
            epics.map((ep) => (
              <EpicRowItem
                key={ep.id}
                epic={ep}
                onColorChange={(c) => onColorChange(ep.id, c)}
                onRename={(n) => onRename(ep.id, n)}
                onDelete={() => onDelete(ep.id, ep.name)}
                disabled={pending}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EpicRowItem({
  epic,
  onColorChange,
  onRename,
  onDelete,
  disabled,
}: {
  epic: EpicRow;
  onColorChange: (c: string) => void;
  onRename: (n: string) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(epic.name);
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== epic.name && onRename(name)}
        disabled={disabled}
      />
      <ColorSwatches value={epic.color} onChange={onColorChange} />
      <Button type="button" variant="ghost" size="icon" onClick={onDelete} disabled={disabled}>
        <Trash2 className="size-4 text-red-600" />
      </Button>
    </div>
  );
}

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {EPIC_COLORS.map((c) => {
        const t = epicTone(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`size-5 rounded-full border-2 transition ${
              value === c ? "ring-2 ring-offset-1" : "hover:scale-110"
            }`}
            style={{
              backgroundColor: t.dot,
              borderColor: value === c ? t.border : "transparent",
            }}
          />
        );
      })}
    </div>
  );
}
