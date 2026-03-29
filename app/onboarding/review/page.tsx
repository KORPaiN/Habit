import { redirect } from "next/navigation";

type ReviewPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function OnboardingReviewPage({ searchParams }: ReviewPageProps) {
  const params = (await searchParams) ?? {};
  const search = new URLSearchParams({ review: "1" });

  if (params.error) {
    search.set("error", params.error);
  }

  if (params.notice) {
    search.set("notice", params.notice);
  }

  redirect(`/onboarding?${search.toString()}`);
}
