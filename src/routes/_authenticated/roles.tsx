import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles & Access — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Roles & access" description="Promote employees, change roles and adjust levels." />
      <PageBody>
        <Placeholder icon={<ShieldCheck className="h-5 w-5" />} title="Role management" description="Assign Founder / HR / Employee roles and update employee levels here." />
      </PageBody>
    </>
  ),
});
