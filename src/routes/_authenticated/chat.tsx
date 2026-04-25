import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { MessagesSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — TrioByte Portal" }] }),
  component: () => (
    <>
      <PageHeader title="Team Chat" description="Direct and group conversations with your colleagues." />
      <PageBody>
        <Placeholder icon={<MessagesSquare className="h-5 w-5" />} title="Chat is coming soon" description="WhatsApp-style messaging with text, files, code snippets and voice notes — both 1-on-1 and group chats." />
      </PageBody>
    </>
  ),
});
