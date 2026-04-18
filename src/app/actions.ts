"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function createProject(name: string, description?: string): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("projects")
    .insert({ owner_id: user.id, name: name.trim(), description: description?.trim() || null });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function renameProject(
  id: string,
  name: string,
  description?: string,
): Promise<Result> {
  if (!name.trim()) return { ok: false, error: "Name is required" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  redirect("/");
}
