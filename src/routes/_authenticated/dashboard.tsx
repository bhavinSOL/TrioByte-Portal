import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { useAuth, roleLabel } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Briefcase, ClipboardCheck, Users, ListChecks, ShieldCheck, Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TrioByte Portal" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { profile, primaryRole } = useAuth();
  const greeting = getGreeting();
  const firstName = (profile?.full_name ?? "there").split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={roleLabel(primaryRole)}
        title={`${greeting}, ${firstName}`}
        description="Here's what's happening in your workspace today."
      />
      <PageBody>
        {primaryRole === "employee" && <EmployeeDashboard />}
        {primaryRole === "hr_admin" && <HRDashboard />}
        {primaryRole === "founder" && <FounderDashboard />}
      </PageBody>
    </>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function StatCard({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className="h-10 w-10 rounded-md bg-secondary text-secondary-foreground grid place-items-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Briefcase} label="Active project" value="—" hint="No project assigned yet" />
        <StatCard icon={ClipboardCheck} label="Today's log" value="0 entries" hint="Add what you worked on" />
        <StatCard icon={CalendarDays} label="This month" value="0 / 0" hint="Days logged" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current project</CardTitle>
            <CardDescription>Your active assignment and upcoming deadline.</CardDescription>
          </CardHeader>
          <CardContent>
            <Placeholder title="No active project" description="Once HR assigns you to a project, you'll see it here with deadline and progress." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance calendar</CardTitle>
            <CardDescription>Your login history this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar mode="single" className="rounded-md border" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Today's work log</CardTitle>
            <CardDescription>Quick notes on what you accomplished today.</CardDescription>
          </div>
          <Button variant="outline" size="sm">Add entry</Button>
        </CardHeader>
        <CardContent>
          <Placeholder title="No log entries today" description="Start logging your work to keep your manager and team in sync." />
        </CardContent>
      </Card>
    </>
  );
}

function HRDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Employees" value="0" hint="Total active" />
        <StatCard icon={CalendarDays} label="Present today" value="0" />
        <StatCard icon={ClipboardCheck} label="Pending leaves" value="0" />
        <StatCard icon={ListChecks} label="Open tasks" value="0" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Onboard a new employee</CardTitle>
              <CardDescription>Create a company account with a temporary password.</CardDescription>
            </div>
            <Badge variant="secondary">HR</Badge>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Employees will be required to change their password on first sign-in.
            </p>
            <Button asChild>
              <Link to="/team">Open team directory</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Logins, leave requests and task completions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Placeholder title="No activity yet" description="Activity will appear here as your team uses the portal." icon={<ShieldCheck className="h-5 w-5" />} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FounderDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Headcount" value="0" />
        <StatCard icon={Briefcase} label="Active projects" value="0" />
        <StatCard icon={CalendarDays} label="Avg attendance" value="—" />
        <StatCard icon={Crown} label="Your access" value="Full" hint="Founder / CEO" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company overview</CardTitle>
            <CardDescription>Cross-team performance at a glance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Placeholder title="Insights coming soon" description="Once teams start logging work, charts and KPIs will appear here." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent management actions</CardTitle>
            <CardDescription>Role changes, blocks, salary updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Placeholder title="No recent actions" description="Audit log of HR/Admin changes will be shown here." />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
