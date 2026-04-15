import type { Route } from "next";
import Link from "next/link";
import { Trash2 } from "lucide-react";

import { deleteAnchorAction, saveAnchorAction } from "@/app/anchors/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/ui/page-shell";
import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser, getAuthShellState } from "@/lib/supabase/auth";
import { getUserAnchors } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { buildAnchorsPath, sanitizeReturnPath } from "@/lib/utils/return-path";
import type { Database } from "@/types";

type AnchorsPageProps = {
  searchParams?: Promise<{
    saved?: string;
    deleted?: string;
    error?: string;
    returnTo?: string;
  }>;
};

export default async function AnchorsPage({ searchParams }: AnchorsPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const user = await getAuthenticatedUser();
  const returnTo = sanitizeReturnPath(params.returnTo);
  const anchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "label" | "preferred_time" | "updated_at">> =
    user ? await getUserAnchors(await getSupabaseServerClient(), user.id) : [];

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path={buildAnchorsPath({ returnTo })}
      title={locale === "ko" ? "저장된 루틴" : "Saved cues"}
      description={locale === "ko" ? "자주 쓰는 루틴을 저장해두면 바로 다시 고를 수 있어요." : "Save cues you reuse often so onboarding can reuse them quickly."}
      className="mx-auto max-w-3xl"
    >
      <div className="grid gap-4">
        {!user ? (
          <Card className="bg-[var(--surface-strong)]">
            <p className="text-sm leading-6 text-[var(--muted)]">
              {locale === "ko" ? "저장하려면 먼저 로그인해 주세요." : "Sign in from the header to save cues."}
            </p>
          </Card>
        ) : (
          <Card className="bg-[var(--surface-strong)]">
            <form action={saveAnchorAction} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="returnTo" value={returnTo} />
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  {locale === "ko" ? "붙일 루틴" : "Cue"}
                </label>
                <Input name="cue" placeholder={locale === "ko" ? "예: 아침 커피 마신 뒤" : "Example: right after my morning coffee"} />
              </div>
              <Button type="submit">{locale === "ko" ? "저장" : "Save"}</Button>
            </form>
            {params.saved === "1" ? <p className="mt-3 text-sm text-[var(--primary)]">{locale === "ko" ? "저장했어요." : "Saved."}</p> : null}
            {params.deleted === "1" ? <p className="mt-3 text-sm text-[var(--primary)]">{locale === "ko" ? "삭제했어요." : "Deleted."}</p> : null}
            {params.error ? <p className="mt-3 text-sm text-amber-800">{params.error}</p> : null}
          </Card>
        )}

        <Card className="bg-[var(--surface-strong)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{locale === "ko" ? "저장된 루틴" : "Saved cues"}</h2>
            <Link href={returnTo as Route}>
              <Button variant="ghost" size="sm">{locale === "ko" ? "온보딩으로" : "Back to onboarding"}</Button>
            </Link>
          </div>
          {anchors.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{locale === "ko" ? "아직 저장된 루틴이 없어요." : "No cues saved yet."}</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              {anchors.map((anchor) => (
                <div
                  key={anchor.id}
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-white/60 bg-[var(--surface-muted)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)]"
                >
                  <span>{anchor.cue}</span>
                  <form action={deleteAnchorAction}>
                    <input type="hidden" name="anchorId" value={anchor.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-white hover:text-rose-600"
                      aria-label={locale === "ko" ? "삭제" : "Delete cue"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
