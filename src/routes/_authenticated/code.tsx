import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { GitBranch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/code")({
  head: () => ({ meta: [{ title: "Code Repos — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Code Repositories" description="Push code, manage versions and raise merge requests for projects you're assigned to." />
      <PageBody>
        <Placeholder icon={<GitBranch className="h-5 w-5" />} title="Repositories will appear here" description="Once you're assigned to a project, you'll be able to upload code, browse versions and open merge requests — GitHub-style." />
      </PageBody>
    </>
  ),
});
