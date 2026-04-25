import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth, roleLabel } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { levelRing } from "@/components/portal/portal-sidebar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — TrioByte Portal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, primaryRole } = useAuth();
  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <PageHeader title="My profile" description="Your personal and employment information." />
      <PageBody>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <div className={cn("h-20 w-20 rounded-full grid place-items-center text-xl font-semibold ring-4 bg-secondary text-secondary-foreground", levelRing(profile?.level ?? 1))}>
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{profile?.full_name ?? "—"}</div>
                <div className="text-sm text-muted-foreground truncate">{profile?.email ?? "—"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{roleLabel(primaryRole)}</Badge>
                  <Badge variant="outline">Level {profile?.level ?? 1}</Badge>
                  {profile?.is_permanent && <Badge>Permanent</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Full name" value={profile?.full_name} />
              <Field label="Mobile" value={profile?.mobile} />
              <Field label="Address" value={profile?.address} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Employee ID" value={profile?.employee_id} />
              <Field label="Company ID" value={profile?.company_id} />
              <Field label="Joining date" value={profile?.joining_date} />
              <Field label="End date" value={profile?.is_permanent ? "Permanent" : profile?.end_date} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value || "—"}</span>
    </div>
  );
}
