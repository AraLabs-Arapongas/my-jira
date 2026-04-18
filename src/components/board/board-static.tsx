"use client";

import { useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ColumnFormDialog } from "./column-form-dialog";
import { deleteColumn } from "@/app/projects/[id]/actions";
import { toast } from "sonner";

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
};

export function BoardStatic({
  projectId,
  columns,
}: {
  projectId: string;
  columns: ColumnRow[];
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((c) => (
        <Column key={c.id} projectId={projectId} column={c} />
      ))}
      <ColumnFormDialog
        mode="create"
        projectId={projectId}
        trigger={
          <Button variant="outline" className="h-10 shrink-0 self-start bg-white/60">
            <Plus className="mr-1 size-4" /> New column
          </Button>
        }
      />
    </div>
  );
}

function Column({ projectId, column }: { projectId: string; column: ColumnRow }) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete column "${column.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteColumn(column.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {column.name}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 hover:bg-neutral-200" aria-label="Column actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ColumnFormDialog
              mode="rename"
              projectId={projectId}
              column={column}
              trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Rename</DropdownMenuItem>}
            />
            {!column.is_default && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-red-600 focus:text-red-700"
                disabled={pending}
              >
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-h-[40px] flex-col gap-2">
        {/* Tasks rendered in Task 8 */}
      </div>
    </div>
  );
}
