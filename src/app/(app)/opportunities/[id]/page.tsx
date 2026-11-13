import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cls } from "@/components/cls";
import { OppForm } from "@/components/opportunities/opp-ui";
import { ConfirmButton } from "@/components/ui";
import { uuid } from "@/lib/actions";
import { getOpportunity } from "@/lib/queries/opportunities";
import { deleteOpportunity } from "../actions";
import { BackLink, PageHeader } from "@/components/page-ui";
import { OPP_STATUS_LABELS } from "@/lib/queries/opportunities";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = uuid.safeParse(id).success ? await getOpportunity(id) : null;
  return { title: `${opp?.name ?? "Opportunity"} · Logbook` };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const opp = await getOpportunity(id);
  if (!opp) notFound();

  return (
    <div className="rise mx-auto flex max-w-3xl flex-col gap-5">
      <BackLink href="/opportunities">Opportunities</BackLink>
      <PageHeader eyebrow={OPP_STATUS_LABELS[opp.status]} title={opp.name} />
      <section className={`${cls.card} p-5`}>
        <OppForm opp={opp} />
      </section>
      <form action={deleteOpportunity.bind(null, opp.id)}>
        <ConfirmButton message={`Delete “${opp.name}”?`}>
          <Trash2 className="size-4" aria-hidden /> Delete
        </ConfirmButton>
      </form>
    </div>
  );
}
