import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/executive")({
  head: () => ({ meta: [{ title: "Executive Overview — TrioByte Portal" }] }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const { primaryRole } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (primaryRole && primaryRole !== "founder") navigate({ to: "/dashboard" });
  }, [primaryRole, navigate]);

  return (
    <>
      <PageHeader eyebrow="Founder / CEO" title="Executive overview" description="Highest-level view of the company across all teams." />
      <PageBody>
        <Placeholder icon={<Crown className="h-5 w-5" />} title="Executive dashboard" description="KPIs, headcount, project health and finance summaries will land here." />
      </PageBody>
    </>
  );
}
