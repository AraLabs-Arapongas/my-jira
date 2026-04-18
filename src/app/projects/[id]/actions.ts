"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
