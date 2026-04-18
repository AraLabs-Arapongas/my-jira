import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions-auth";

export async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 shadow-[0_1px_0_rgba(9,30,66,0.08)]">
      <Link href="/" className="text-sm font-semibold">
        my-jira
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">{user.email}</span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
