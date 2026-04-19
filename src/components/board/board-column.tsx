"use client";

import { useState, useTransition } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal, Plus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnFormDialog } from "./column-form-dialog";
import { TaskCard, type EpicRow, type TaskRow } from "./task-card";
import { createTask, deleteColumn } from "@/app/projects/[id]/actions";
import { toast } from "sonner";
import type { ColumnRow } from "@/app/projects/[id]/board";

export function SortableTaskCard({
  task,
  epic,
  onClick,
}: {
  task: TaskRow;
  epic?: EpicRow | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        epic={epic}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

export function BoardColumn({
  projectId,
  column,
  tasks,
  epicsById,
  onTaskClick,
}: {
  projectId: string;
  column: ColumnRow;
  tasks: TaskRow[];
  epicsById: Map<string, EpicRow>;
  onTaskClick: (t: TaskRow) => void;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: "column", column } });

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

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
    <div
      ref={setNodeRef}
      style={style}
      className="flex w-[280px] shrink-0 flex-col rounded-md bg-[#EBECF0] p-2"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
            aria-label="Drag column"
          >
            <GripVertical className="size-3.5" />
          </button>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {column.name}
            <span className="ml-2 font-normal text-neutral-500">{tasks.length}</span>
          </h3>
        </div>
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

      <div ref={setDroppableRef} className="flex min-h-[40px] flex-col gap-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard
              key={t.id}
              task={t}
              epic={t.epic_id ? epicsById.get(t.epic_id) : null}
              onClick={() => onTaskClick(t)}
            />
          ))}
        </SortableContext>
      </div>

      {adding ? (
        <form onSubmit={onAdd} className="mt-2 space-y-2">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
            <Button
              type="button" size="sm" variant="ghost"
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
