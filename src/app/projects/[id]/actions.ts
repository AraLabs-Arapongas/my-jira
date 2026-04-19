"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { midpoint } from "@/lib/utils/position";

type Result = { ok: true } | { ok: false; error: string };

export async function createColumn(projectId: string, name: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("board_columns")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = (maxRow?.position ?? 0) + 1;

  const { error } = await supabase.from("board_columns").insert({
    project_id: projectId,
    name: name.trim(),
    position: nextPos,
    is_default: false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function renameColumn(id: string, name: string, projectId: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("board_columns")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteColumn(id: string, projectId: string): Promise<Result> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Move or delete tasks in this column first." };
  }

  const { error } = await supabase.from("board_columns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function reorderColumns(projectId: string, orderedIds: string[]): Promise<Result> {
  const supabase = await createClient();
  const updates = orderedIds.map((id, i) =>
    supabase.from("board_columns").update({ position: i + 1 }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---- Tasks ----

export async function createTask(
  projectId: string,
  columnId: string,
  title: string,
): Promise<Result> {
  if (!title.trim()) return { ok: false, error: "Title is required" };
  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPos = midpoint(maxRow?.position ?? null, null);

  const { error } = await supabase.from("tasks").insert({
    column_id: columnId,
    title: title.trim(),
    position: nextPos,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateTask(
  projectId: string,
  id: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high";
    label?: string | null;
    epic_id?: string | null;
  },
): Promise<Result> {
  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "Title cannot be empty" };
  }
  const cleaned: Record<string, unknown> = { ...patch };
  if (typeof cleaned.title === "string") cleaned.title = (cleaned.title as string).trim();
  if (typeof cleaned.description === "string")
    cleaned.description = (cleaned.description as string).trim() || null;
  if (typeof cleaned.label === "string")
    cleaned.label = (cleaned.label as string).trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(cleaned).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// ---- Epics ----

export async function createEpic(
  projectId: string,
  name: string,
  color: string,
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase.from("epics").insert({
    project_id: projectId,
    name: name.trim(),
    color,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateEpic(
  projectId: string,
  id: string,
  patch: { name?: string; color?: string },
): Promise<Result> {
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, error: "Name cannot be empty" };
  }
  const cleaned: Record<string, unknown> = { ...patch };
  if (typeof cleaned.name === "string") cleaned.name = (cleaned.name as string).trim();
  const supabase = await createClient();
  const { error } = await supabase.from("epics").update(cleaned).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteEpic(projectId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("epics").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteTask(projectId: string, id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function createTasksBulk(
  projectId: string,
  columnId: string,
  rows: Array<{
    title: string;
    description?: string | null;
    priority?: "low" | "medium" | "high";
    label?: string | null;
    epic_id?: string | null;
  }>,
): Promise<Result> {
  const clean = rows
    .map((r) => ({
      title: (r.title ?? "").trim(),
      description: r.description?.trim() || null,
      priority: r.priority ?? "medium",
      label: r.label?.trim() || null,
      epic_id: r.epic_id ?? null,
    }))
    .filter((r) => r.title.length > 0);

  if (clean.length === 0) return { ok: false, error: "No valid rows" };

  const supabase = await createClient();

  const { data: maxRow } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  let pos = maxRow?.position ?? 0;
  const payload = clean.map((r) => {
    pos = midpoint(pos, null);
    return { column_id: columnId, ...r, position: pos };
  });

  const { error } = await supabase.from("tasks").insert(payload);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function moveTask(
  projectId: string,
  id: string,
  newColumnId: string,
  newPosition: number,
): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ column_id: newColumnId, position: newPosition })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
