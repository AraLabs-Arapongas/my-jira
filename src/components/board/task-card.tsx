"use client";

import { ChevronDown, Minus, ChevronUp } from "lucide-react";
import type { HTMLAttributes } from "react";
import { labelColor } from "@/lib/utils/label-color";

export type TaskRow = {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  label: string | null;
  position: number;
};

const priorityIcon = {
  low: <ChevronDown className="size-3.5 text-blue-600" />,
  medium: <Minus className="size-3.5 text-amber-500" />,
  high: <ChevronUp className="size-3.5 text-red-600" />,
} as const;

export function TaskCard({
  task,
  onClick,
  dragHandleProps,
  isDragging,
}: {
  task: TaskRow;
  onClick?: () => void;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}) {
  const colors = task.label ? labelColor(task.label) : null;
  return (
    <div
      {...dragHandleProps}
      onClick={onClick}
      className={`cursor-grab rounded border border-neutral-200 bg-white p-2 text-[13px] shadow-sm transition hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {task.label && colors && (
        <span
          className="mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          {task.label}
        </span>
      )}
      <p className="line-clamp-2 font-medium leading-snug text-neutral-800">{task.title}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-[11px] text-neutral-500">{task.description}</p>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span>{task.id.slice(0, 6)}</span>
        {priorityIcon[task.priority]}
      </div>
    </div>
  );
}
