import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  return (
    <PageShell
      eyebrow="Create account"
      title="Set up a softer starting point."
      description="Create an account to save your goals, plan versions, and weekly reviews. Supabase auth can plug into this form when the backend is ready."
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
            <Input type="password" placeholder="Choose a password" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">What goal brings you here?</label>
            <Input type="text" placeholder="Example: start writing again" />
          </div>
          <Button type="submit" fullWidth>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)]">
            Sign in
          </Link>
        </p>
      </Card>
    </PageShell>
  );
}
