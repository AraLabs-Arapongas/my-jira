"use client";

import { useState, useTransition } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createProject, renameProject } from "@/app/actions";

type Props =
  | { mode: "create"; trigger: React.ReactNode }
  | {
      mode: "edit";
      trigger: React.ReactNode;
      project: { id: string; name: string; description: string | null };
    };

export function ProjectFormDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.mode === "edit" ? props.project.name : "");
  const [description, setDescription] = useState(
    props.mode === "edit" ? (props.project.description ?? "") : "",
  );
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res =
        props.mode === "create"
          ? await createProject(name, description)
          : await renameProject(props.project.id, name, description);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(props.mode === "create" ? "Project created" : "Project updated");
      setOpen(false);
      if (props.mode === "create") {
        setName("");
        setDescription("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={props.trigger as React.ReactElement}></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "New project" : "Edit project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
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
