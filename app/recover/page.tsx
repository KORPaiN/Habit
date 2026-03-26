import { RecoveryFlow } from "@/components/today/recovery-flow";
import { PageShell } from "@/components/ui/page-shell";
import { getRecoveryPageState } from "@/app/recover/actions";

type RecoveryPageProps = {
  searchParams?: Promise<{
    reason?: "too_big" | "too_tired" | "forgot" | "schedule_conflict" | "low_motivation" | "other";
  }>;
};

export default async function RecoveryPage({ searchParams }: RecoveryPageProps) {
  const { currentAction, goal } = await getRecoveryPageState();
  const params = (await searchParams) ?? {};

  return (
    <PageShell
      eyebrow="Recovery"
      title="A hard day means we redesign the step."
      description="If today's action felt too big, we can make it smaller right away. You only need one version that feels possible."
    >
      <RecoveryFlow currentAction={currentAction} goal={goal} initialReason={params.reason} />
    </PageShell>
  );
}
