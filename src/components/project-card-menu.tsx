"use client";

import { useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectFormDialog } from "./project-form-dialog";
import { deleteProject } from "@/app/actions";
import { toast } from "sonner";

export function ProjectCardMenu({
  project,
}: {
  project: { id: string; name: string; description: string | null };
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${project.name}" and all its tasks?`)) return;
    startTransition(async () => {
      const res = await deleteProject(project.id);
      if (res && "ok" in res && !res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.preventDefault()}
        className="rounded p-1 hover:bg-neutral-100"
        aria-label="Project actions"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
        <ProjectFormDialog
          mode="edit"
          project={project}
          trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
        />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700"
          onSelect={onDelete}
          disabled={pending}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
