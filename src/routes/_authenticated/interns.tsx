import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/interns")({
  head: () => ({ meta: [{ title: "Interns — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Intern management" description="Track intern details, mentors and progress." />
      <PageBody>
        <Placeholder icon={<GraduationCap className="h-5 w-5" />} title="No interns yet" description="Onboard interns through the team directory and mark them here." />
      </PageBody>
    </>
  ),
});
