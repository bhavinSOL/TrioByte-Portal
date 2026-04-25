import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Attendance" description="Login history, days present and leave records across the team." />
      <PageBody>
        <Placeholder icon={<CalendarCheck className="h-5 w-5" />} title="Attendance tracking" description="Calendar views, monthly summaries and per-employee history will appear here once login data is collected." />
      </PageBody>
    </>
  ),
});
