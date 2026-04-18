import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BoardStatic } from "@/components/board/board-static";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: columns } = await supabase
    .from("board_columns")
    .select("id, name, position, is_default")
    .eq("project_id", id)
    .order("position");

  const columnIds = (columns ?? []).map((c) => c.id);
  const { data: tasks } =
    columnIds.length === 0
      ? { data: [] as { id: string; column_id: string; title: string; description: string | null; priority: string; label: string | null; position: number }[] }
      : await supabase
          .from("tasks")
          .select("id, column_id, title, description, priority, label, position")
          .in("column_id", columnIds);

  return (
    <main className="mx-auto max-w-[1400px] p-4">
      <nav className="mb-3 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Projects</Link>
        <span className="mx-1">/</span>
        <span className="text-neutral-700">{project.name}</span>
      </nav>
      <BoardStatic
        projectId={project.id}
        columns={columns ?? []}
        tasks={tasks ?? []}
      />
    </main>
  );
}
