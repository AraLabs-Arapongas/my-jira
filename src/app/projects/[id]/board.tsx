"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardColumn } from "@/components/board/board-column";
import { ColumnFormDialog } from "@/components/board/column-form-dialog";
import { TaskCard, type TaskRow } from "@/components/board/task-card";
import { TaskDialog } from "@/components/board/task-dialog";
import { moveTask, reorderColumns } from "./actions";
import { midpoint } from "@/lib/utils/position";
import { toast } from "sonner";

export type ColumnRow = {
  id: string;
  name: string;
  position: number;
  is_default: boolean;
};

export function Board({
  projectId,
  initialColumns,
  initialTasks,
}: {
  projectId: string;
  initialColumns: ColumnRow[];
  initialTasks: TaskRow[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  function onDragStart(e: DragStartEvent) {
    const { active } = e;
    if (active.data.current?.type === "task") {
      setActiveTask(active.data.current.task as TaskRow);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Column reorder
    if (activeType === "column" && overType === "column" && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      const next = arrayMove(columns, oldIndex, newIndex);
      setColumns(next);
      startTransition(async () => {
        const res = await reorderColumns(projectId, next.map((c) => c.id));
        if (!res.ok) {
          toast.error(res.error);
          setColumns(columns); // revert
        }
      });
      return;
    }

    // Task move (drop on a task OR on a column's droppable area)
    if (activeType === "task") {
      const draggedId = active.id as string;
      const dragged = tasks.find((t) => t.id === draggedId);
      if (!dragged) return;

      let targetColumnId: string;
      let insertBeforeTaskId: string | null = null;

      if (overType === "task") {
        const overTask = over.data.current!.task as TaskRow;
        targetColumnId = overTask.column_id;
        insertBeforeTaskId = overTask.id;
      } else if (overType === "column-drop") {
        targetColumnId = over.data.current!.columnId as string;
        insertBeforeTaskId = null; // drop at end
      } else {
        return;
      }

      const colTasks = tasks
        .filter((t) => t.column_id === targetColumnId && t.id !== draggedId)
        .sort((a, b) => a.position - b.position);

      let prev: TaskRow | null = null;
      let next: TaskRow | null = null;
      if (insertBeforeTaskId) {
        const idx = colTasks.findIndex((t) => t.id === insertBeforeTaskId);
        prev = idx > 0 ? colTasks[idx - 1] : null;
        next = colTasks[idx] ?? null;
      } else {
        prev = colTasks[colTasks.length - 1] ?? null;
      }

      const newPosition = midpoint(prev?.position ?? null, next?.position ?? null);

      const prevState = tasks;
      setTasks((ts) =>
        ts.map((t) =>
          t.id === draggedId ? { ...t, column_id: targetColumnId, position: newPosition } : t,
        ),
      );

      startTransition(async () => {
        const res = await moveTask(projectId, draggedId, targetColumnId, newPosition);
        if (!res.ok) {
          toast.error(res.error);
          setTasks(prevState);
        }
      });
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map((c) => (
              <BoardColumn
                key={c.id}
                projectId={projectId}
                column={c}
                tasks={tasks
                  .filter((t) => t.column_id === c.id)
                  .sort((a, b) => a.position - b.position)}
                onTaskClick={setOpenTask}
              />
            ))}
          </SortableContext>
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
        <DragOverlay>{activeTask && <TaskCard task={activeTask} />}</DragOverlay>
      </DndContext>

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
