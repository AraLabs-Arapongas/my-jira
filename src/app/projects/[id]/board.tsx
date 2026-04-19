"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  closestCorners, useSensor, useSensors,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Layers, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardColumn } from "@/components/board/board-column";
import { ColumnFormDialog } from "@/components/board/column-form-dialog";
import { CsvImportDialog } from "@/components/board/csv-import-dialog";
import { EpicsDialog } from "@/components/board/epics-dialog";
import { TaskCard, type EpicRow, type TaskRow } from "@/components/board/task-card";
import { TaskDialog } from "@/components/board/task-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { moveTask, reorderColumns } from "./actions";
import { midpoint } from "@/lib/utils/position";
import { epicTone } from "@/lib/utils/epic-color";
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
  initialEpics,
}: {
  projectId: string;
  initialColumns: ColumnRow[];
  initialTasks: TaskRow[];
  initialEpics: EpicRow[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [epics, setEpics] = useState(initialEpics);
  const [openTask, setOpenTask] = useState<TaskRow | null>(null);
  const [activeTask, setActiveTask] = useState<TaskRow | null>(null);
  const [epicFilter, setEpicFilter] = useState<string>("all"); // "all" | "none" | epicId
  const [, startTransition] = useTransition();

  useEffect(() => setColumns(initialColumns), [initialColumns]);
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setEpics(initialEpics), [initialEpics]);

  const epicsById = useMemo(() => {
    const m = new Map<string, EpicRow>();
    for (const e of epics) m.set(e.id, e);
    return m;
  }, [epics]);

  const visibleTasks = useMemo(() => {
    if (epicFilter === "all") return tasks;
    if (epicFilter === "none") return tasks.filter((t) => !t.epic_id);
    return tasks.filter((t) => t.epic_id === epicFilter);
  }, [tasks, epicFilter]);

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

    if (activeType === "column" && overType === "column" && active.id !== over.id) {
      const oldIndex = columns.findIndex((c) => c.id === active.id);
      const newIndex = columns.findIndex((c) => c.id === over.id);
      const next = arrayMove(columns, oldIndex, newIndex);
      setColumns(next);
      startTransition(async () => {
        const res = await reorderColumns(projectId, next.map((c) => c.id));
        if (!res.ok) {
          toast.error(res.error);
          setColumns(columns);
        }
      });
      return;
    }

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
        insertBeforeTaskId = null;
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
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Epic</span>
          <Select value={epicFilter} onValueChange={(v) => setEpicFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No epic</SelectItem>
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
        <div className="flex items-center gap-2">
          <EpicsDialog
            projectId={projectId}
            epics={epics}
            trigger={
              <Button variant="outline" size="sm">
                <Layers className="mr-1 size-4" /> Epics
              </Button>
            }
          />
          <CsvImportDialog
            projectId={projectId}
            columns={columns}
            epics={epics}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="mr-1 size-4" /> Import CSV
              </Button>
            }
          />
        </div>
      </div>
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
                tasks={visibleTasks
                  .filter((t) => t.column_id === c.id)
                  .sort((a, b) => a.position - b.position)}
                epicsById={epicsById}
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
        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              epic={activeTask.epic_id ? epicsById.get(activeTask.epic_id) : null}
            />
          )}
        </DragOverlay>
      </DndContext>

      {openTask && (
        <TaskDialog
          projectId={projectId}
          task={openTask}
          epics={epics}
          open
          onOpenChange={(o) => !o && setOpenTask(null)}
        />
      )}
    </>
  );
}
