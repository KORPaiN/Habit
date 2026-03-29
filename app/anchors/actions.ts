"use server";

import { redirect } from "next/navigation";

import { getLocale } from "@/lib/locale";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { deleteUserAnchor, saveUserAnchor } from "@/lib/supabase/habit-service";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { savedAnchorSchema } from "@/lib/validators/habit";

export async function saveAnchorAction(formData: FormData) {
  const locale = await getLocale();
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/anchors")}`);
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

    redirect(`/anchors?error=${encodeURIComponent(message)}`);
  }

  redirect("/anchors?saved=1");
}

export async function deleteAnchorAction(formData: FormData) {
  const locale = await getLocale();
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/anchors")}`);
  }

  const anchorId = String(formData.get("anchorId") ?? "");

  if (!anchorId) {
    redirect(`/anchors?error=${encodeURIComponent(locale === "ko" ? "삭제할 기존 습관을 찾지 못했어요." : "We could not find that cue.")}`);
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

    redirect(`/anchors?error=${encodeURIComponent(message)}`);
  }

  redirect("/anchors?deleted=1");
}
