import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave Requests — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Leave requests" description="Approve or reject employee leave applications." />
      <PageBody>
        <Placeholder icon={<ClipboardList className="h-5 w-5" />} title="No pending requests" description="When employees submit leave, you'll review and act on them here." />
      </PageBody>
    </>
  ),
});
