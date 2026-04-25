import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Salary & Overtime — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Salary & overtime" description="Monthly salary records and extra-hours tracking." />
      <PageBody>
        <Placeholder icon={<Wallet className="h-5 w-5" />} title="Payroll module" description="Salary and overtime tracking will be enabled in a follow-up." />
      </PageBody>
    </>
  ),
});
