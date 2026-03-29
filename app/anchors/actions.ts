"use server";

import { redirect } from "next/navigation";

import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { deleteUserAnchor, saveUserAnchor } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { buildAnchorsPath, sanitizeReturnPath } from "@/lib/utils/return-path";
import { savedAnchorSchema } from "@/lib/validators/habit";

export async function saveAnchorAction(formData: FormData) {
  const locale = await getLocale();
  const user = await getAuthenticatedUser();
  const returnTo = sanitizeReturnPath(typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : undefined);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(buildAnchorsPath({ returnTo }))}` as any);
  }

  const parsed = savedAnchorSchema.parse({
    cue: formData.get("cue"),
  });

  try {
    await saveUserAnchor(await getSupabaseServerClient(), {
      userId: user.id,
      cue: parsed.cue,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : locale === "ko"
          ? "기존 습관을 저장하지 못했어요."
          : "We could not save your cue.";

    redirect(buildAnchorsPath({ returnTo, error: message }) as any);
  }

  redirect(buildAnchorsPath({ returnTo, saved: true }) as any);
}

export async function deleteAnchorAction(formData: FormData) {
  const locale = await getLocale();
  const user = await getAuthenticatedUser();
  const returnTo = sanitizeReturnPath(typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : undefined);

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(buildAnchorsPath({ returnTo }))}` as any);
  }

  const anchorId = String(formData.get("anchorId") ?? "");

  if (!anchorId) {
    redirect(buildAnchorsPath({ returnTo, error: locale === "ko" ? "삭제할 기존 습관을 찾지 못했어요." : "We could not find that cue." }) as any);
  }

  try {
    await deleteUserAnchor(await getSupabaseServerClient(), {
      userId: user.id,
      anchorId,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : locale === "ko"
          ? "기존 습관을 삭제하지 못했어요."
          : "We could not delete that cue.";

    redirect(buildAnchorsPath({ returnTo, error: message }) as any);
  }

  redirect(buildAnchorsPath({ returnTo, deleted: true }) as any);
}
