import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks & Deadlines — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Tasks & deadlines" description="Assign work, track progress and manage project deadlines." />
      <PageBody>
        <Placeholder icon={<ListChecks className="h-5 w-5" />} title="No tasks yet" description="Create projects and tasks, then assign them to employees with deadlines." />
      </PageBody>
    </>
  ),
});
