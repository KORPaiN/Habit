import Link from "next/link";

import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <PageShell
      eyebrow="Welcome back"
      title="Step in gently."
      description="Sign in to return to today’s small action. Auth is scaffolded with placeholder fields until Supabase credentials are connected."
      className="mx-auto max-w-xl"
    >
      <Card>
        <form className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Email</label>
            <Input type="email" placeholder="you@example.com" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Password</label>
            <Input type="password" placeholder="Your password" />
          </div>
          <Button type="submit" fullWidth>
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          New here?{" "}
          <Link href="/signup" className="font-semibold text-[var(--primary)]">
            Create an account
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
