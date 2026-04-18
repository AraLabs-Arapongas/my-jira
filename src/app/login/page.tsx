import LoginForm from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">my-jira</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in with a magic link.
        </p>
        <LoginForm searchParamsPromise={searchParams} />
      </div>
    </main>
  );
}
