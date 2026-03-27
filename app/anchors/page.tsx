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
import type { Database } from "@/types";

type AnchorsPageProps = {
  searchParams?: Promise<{
    saved?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function AnchorsPage({ searchParams }: AnchorsPageProps) {
  const params = (await searchParams) ?? {};
  const locale = await getLocale();
  const auth = await getAuthShellState();
  const user = await getAuthenticatedUser();
  const anchors: Array<Pick<Database["public"]["Tables"]["anchors"]["Row"], "id" | "cue" | "label" | "preferred_time" | "updated_at">> =
    user ? await getUserAnchors(await getSupabaseServerClient(), user.id) : [];

  return (
    <PageShell
      auth={auth}
      locale={locale}
      path="/anchors"
      title={locale === "ko" ? "앵커를 저장해 둘 수 있어요." : "Save anchors for later"}
      description={locale === "ko" ? "자주 쓰는 앵커를 저장하면 온보딩에서 바로 다시 고를 수 있어요." : "Save cues you reuse often so onboarding can reuse them quickly."}
      className="mx-auto max-w-3xl"
    >
      <div className="grid gap-4">
        {!user ? (
          <Card className="bg-[var(--surface-strong)]">
            <p className="text-sm leading-6 text-[var(--muted)]">
              {locale === "ko"
                ? "앵커를 저장하려면 먼저 헤더의 로그인 버튼으로 로그인해 주세요."
                : "Sign in from the header to save anchors."}
            </p>
          </Card>
        ) : (
          <Card className="bg-[var(--surface-strong)]">
            <form action={saveAnchorAction} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground-soft)]">
                  {locale === "ko" ? "앵커 행동" : "Anchor cue"}
                </label>
                <Input
                  name="cue"
                  placeholder={locale === "ko" ? "예: 아침에 커피를 마신 직후" : "Example: right after my morning coffee"}
                />
              </div>
              <Button type="submit">{locale === "ko" ? "저장" : "Save"}</Button>
            </form>
            {params.saved === "1" ? (
              <p className="mt-3 text-sm text-[var(--primary)]">{locale === "ko" ? "앵커를 저장했어요." : "Anchor saved."}</p>
            ) : null}
            {params.deleted === "1" ? (
              <p className="mt-3 text-sm text-[var(--primary)]">{locale === "ko" ? "앵커를 삭제했어요." : "Anchor deleted."}</p>
            ) : null}
            {params.error ? <p className="mt-3 text-sm text-amber-800">{params.error}</p> : null}
          </Card>
        )}

        <Card className="bg-[var(--surface-strong)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{locale === "ko" ? "저장된 앵커" : "Saved anchors"}</h2>
            <Link href="/onboarding">
              <Button variant="ghost" size="sm">{locale === "ko" ? "온보딩으로" : "Back to onboarding"}</Button>
            </Link>
          </div>
          {anchors.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {locale === "ko" ? "아직 저장된 앵커가 없어요." : "No anchors saved yet."}
            </p>
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
                    <button
                      type="submit"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-white hover:text-rose-600"
                      aria-label={locale === "ko" ? "앵커 삭제" : "Delete anchor"}
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
