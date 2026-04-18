"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnFormDialog } from "./column-form-dialog";
import { TaskCard, type TaskRow } from "./task-card";
import { TaskDialog } from "./task-dialog";
import { createTask, deleteColumn } from "@/app/projects/[id]/actions";
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
  tasks,
}: {
  projectId: string;
  columns: ColumnRow[];
  tasks: TaskRow[];
}) {
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((c) => (
          <Column
            key={c.id}
            projectId={projectId}
            column={c}
            tasks={tasks.filter((t) => t.column_id === c.id).sort((a, b) => a.position - b.position)}
            onTaskClick={setOpenTask}
          />
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
      {openTask && (
        <TaskDialog
          projectId={projectId}
          task={openTask}
          open
          onOpenChange={(o) => !o && setOpenTask(null)}
        />
      )}
    </>
  );
}

function Column({
  projectId,
  column,
  tasks,
  onTaskClick,
}: {
  projectId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  onTaskClick: (t: TaskRow) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  function onDelete() {
    if (!confirm(`Delete column "${column.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteColumn(column.id, projectId);
      if (!res.ok) toast.error(res.error);
    });
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await createTask(projectId, column.id, title);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTitle("");
      setAdding(false);
    });
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {column.name}
          <span className="ml-2 font-normal text-neutral-500">{tasks.length}</span>
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
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)} />
        ))}
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="mt-2 space-y-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setAdding(false); setTitle(""); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 flex items-center gap-1 rounded px-1 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-200"
        >
          <Plus className="size-3.5" /> Add a card
        </button>
      )}
    </div>
  );
}
