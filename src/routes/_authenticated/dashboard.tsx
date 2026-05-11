import { createFileRoute, Link } from "@tanstack/react-router";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { useAuth, roleLabel } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays, Briefcase, ClipboardCheck, Users, ListChecks, ShieldCheck, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { user } = useAuth();
  const [projectData, setProjectData] = useState<any>(null);
  const [tasksData, setTasksData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch current project
        const { data: projectMembers } = await (supabase as any)
          .from("project_members")
          .select("*, projects(*)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        // Fetch today's tasks
        const { data: tasks } = await (supabase as any)
          .from("tasks")
          .select("*")
          .eq("assigned_to", user.id)
          .order("created_at", { ascending: false });

        // Fetch attendance for today
        const { data: attendance } = await (supabase as any)
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();

        // Fetch this month's attendance
        const { data: monthAttendance } = await (supabase as any)
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", today.slice(0, 7) + "-01")
          .lte("date", today);

        setProjectData(projectMembers);
        setTasksData(tasks || []);
        setAttendanceData({ today: attendance, month: monthAttendance || [] });
      } catch (error) {
        console.error("Error fetching employee dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id]);

  const completedTasksToday = tasksData.filter(t => t.status === "completed").length;
  const presentDays = attendanceData?.month?.filter((a: any) => a.status === "present").length || 0;

  if (loading) {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Briefcase} label="Active project" value={projectData?.projects?.name || "—"} hint={projectData ? `Role: ${projectData.role}` : "No project assigned yet"} />
        <StatCard icon={ClipboardCheck} label="Today's log" value={`${completedTasksToday} completed`} hint={`${tasksData.length} total tasks`} />
        <StatCard icon={CalendarDays} label="This month" value={`${presentDays} / ${attendanceData?.month?.length || 0}`} hint="Days present" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Current project</CardTitle>
            <CardDescription>Your active assignment and upcoming deadline.</CardDescription>
          </CardHeader>
          <CardContent>
            {projectData?.projects ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-foreground">{projectData.projects.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{projectData.projects.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Role: </span>
                    <span className="font-medium">{projectData.role}</span>
                  </div>
                  {projectData.projects.end_date && (
                    <Badge variant="outline">Due: {new Date(projectData.projects.end_date).toLocaleDateString()}</Badge>
                  )}
                </div>
              </div>
            ) : (
              <Placeholder title="No active project" description="Once HR assigns you to a project, you'll see it here with deadline and progress." />
            )}
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
          <Button variant="outline" size="sm" asChild>
            <Link to="/tasks">View all tasks</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {tasksData.length > 0 ? (
            <div className="space-y-3">
              {tasksData.slice(0, 5).map((task: any) => (
                <div key={task.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">{task.title}</h4>
                    {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                  </div>
                  <Badge variant={task.status === "completed" ? "default" : "outline"} className="ml-2">
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <Placeholder title="No log entries today" description="Start logging your work to keep your manager and team in sync." />
          )}
        </CardContent>
      </Card>
    </>
  );
}

function HRDashboard() {
  const [stats, setStats] = useState({
    employees: 0,
    presentToday: 0,
    pendingLeaves: 0,
    openTasks: 0,
    recentActivity: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHRData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Get total employees
        const { count: employeeCount } = await (supabase as any)
          .from("profiles")
          .select("*", { count: "exact" });

        // Get present today
        const { data: presentToday } = await (supabase as any)
          .from("attendance")
          .select("*")
          .eq("date", today)
          .eq("status", "present");

        // Get pending leaves
        const { count: pendingLeavesCount } = await (supabase as any)
          .from("leave_requests")
          .select("*", { count: "exact" })
          .eq("status", "pending");

        // Get open tasks
        const { data: openTasks } = await (supabase as any)
          .from("tasks")
          .select("*")
          .eq("status", "open");

        // Get recent activity (attendance, leaves, tasks)
        const { data: recentAttendance } = await (supabase as any)
          .from("attendance")
          .select("*, user_id")
          .order("created_at", { ascending: false })
          .limit(3);

        const { data: recentLeaves } = await (supabase as any)
          .from("leave_requests")
          .select("*, user_id")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(3);

        setStats({
          employees: employeeCount || 0,
          presentToday: presentToday?.length || 0,
          pendingLeaves: pendingLeavesCount || 0,
          openTasks: openTasks?.length || 0,
          recentActivity: [...(recentAttendance || []), ...(recentLeaves || [])].slice(0, 5)
        });
      } catch (error) {
        console.error("Error fetching HR dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHRData();
  }, []);

  if (loading) {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Employees" value={stats.employees.toString()} hint="Total active" />
        <StatCard icon={CalendarDays} label="Present today" value={stats.presentToday.toString()} />
        <StatCard icon={ClipboardCheck} label="Pending leaves" value={stats.pendingLeaves.toString()} />
        <StatCard icon={ListChecks} label="Open tasks" value={stats.openTasks.toString()} />
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
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity: any, i: number) => (
                  <div key={i} className="text-sm border-b pb-2 last:border-0">
                    <div className="font-medium text-foreground">
                      {'login_time' in activity ? '📋 Attendance' : '📅 Leave Request'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activity.user_id ? 'User: ' + activity.user_id.slice(0, 8) : 'Recent activity'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <Placeholder title="No activity yet" description="Activity will appear here as your team uses the portal." icon={<ShieldCheck className="h-5 w-5" />} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function FounderDashboard() {
  const [stats, setStats] = useState({
    headcount: 0,
    activeProjects: 0,
    avgAttendance: 0,
    recentActions: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFounderData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.slice(0, 7) + '-01';

        // Get headcount
        const { count: headcount } = await (supabase as any)
          .from("profiles")
          .select("*", { count: "exact" });

        // Get active projects
        const { data: projects } = await (supabase as any)
          .from("projects")
          .select("*")
          .neq("status", "completed");

        // Get attendance for average calculation
        const { data: monthAttendance } = await (supabase as any)
          .from("attendance")
          .select("*")
          .gte("date", monthStart)
          .lte("date", today);

        // Get recent management actions (role changes, updates)
        const { data: recentProfiles } = await (supabase as any)
          .from("profiles")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(5);

        const { data: recentProjectUpdates } = await (supabase as any)
          .from("projects")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(3);

        // Calculate average attendance
        const totalDays = new Set((monthAttendance || []).map((a: any) => a.user_id)).size || 1;
        const totalPresent = (monthAttendance || []).filter((a: any) => a.status === "present").length;
        const avgAttendance = totalPresent > 0 ? Math.round((totalPresent / totalDays) * 100) : 0;

        setStats({
          headcount: headcount || 0,
          activeProjects: projects?.length || 0,
          avgAttendance,
          recentActions: [...(recentProfiles || []), ...(recentProjectUpdates || [])].slice(0, 5)
        });
      } catch (error) {
        console.error("Error fetching founder dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFounderData();
  }, []);

  if (loading) {
    return (
      <>
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Headcount" value={stats.headcount.toString()} />
        <StatCard icon={Briefcase} label="Active projects" value={stats.activeProjects.toString()} />
        <StatCard icon={CalendarDays} label="Avg attendance" value={`${stats.avgAttendance}%`} />
        <StatCard icon={Crown} label="Your access" value="Full" hint="Founder / CEO" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company overview</CardTitle>
            <CardDescription>Cross-team performance at a glance.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.headcount > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-medium">Total Employees</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.headcount}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-medium">Active Projects</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stats.activeProjects}</p>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Team Attendance Rate</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${stats.avgAttendance}%` }} />
                    </div>
                    <span className="text-sm font-semibold">{stats.avgAttendance}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <Placeholder title="Insights coming soon" description="Once teams start logging work, charts and KPIs will appear here." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent management actions</CardTitle>
            <CardDescription>Role changes, blocks, salary updates.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentActions.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActions.map((action: any, i: number) => (
                  <div key={i} className="text-sm border-b pb-2 last:border-0">
                    <div className="font-medium text-foreground">
                      {'name' in action ? '👤 Profile Update' : '📊 Project Update'}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.full_name || action.name || 'System'}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {new Date(action.updated_at).toLocaleDateString()}
                    </time>
                  </div>
                ))}
              </div>
            ) : (
              <Placeholder title="No recent actions" description="Audit log of HR/Admin changes will be shown here." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
