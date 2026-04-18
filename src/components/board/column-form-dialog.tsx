"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createColumn, renameColumn } from "@/app/projects/[id]/actions";

type Props =
  | { mode: "create"; projectId: string; trigger: React.ReactNode }
  | { mode: "rename"; projectId: string; trigger: React.ReactNode; column: { id: string; name: string } };

export function ColumnFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.mode === "rename" ? props.column.name : "");
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createColumn(props.projectId, name)
          : await renameColumn(props.column.id, name, props.projectId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      if (props.mode === "create") setName("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={props.trigger as React.ReactElement}></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New column" : "Rename column"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="column-name">Name</Label>
            <Input id="column-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
