import Link from "next/link";
import { ProjectCardMenu } from "./project-card-menu";

export function ProjectCard({
  project,
}: {
  project: { id: string; name: string; description: string | null };
}) {
  return (
    <div className="relative rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="absolute right-2 top-2">
        <ProjectCardMenu project={project} />
      </div>
      <Link href={`/projects/${project.id}`} className="block">
        <h3 className="mb-1 pr-8 text-sm font-semibold">{project.name}</h3>
        {project.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
        )}
      </Link>
    </div>
  );
}
