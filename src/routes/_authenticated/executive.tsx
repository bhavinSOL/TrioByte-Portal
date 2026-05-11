import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { Crown, TrendingUp, Users, Briefcase, CheckCircle2, AlertCircle, DollarSign, Calendar } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/executive")({
  head: () => ({ meta: [{ title: "Executive Overview — TrioByte Portal" }] }),
  component: ExecutivePage,
});

interface ExecutiveMetrics {
  headcount: number;
  activeProjects: number;
  completedProjects: number;
  onHoldProjects: number;
  teamAttendance: number;
  taskCompletionRate: number;
  totalPayroll: number;
  openTasks: number;
}

interface TeamMember {
  id: string;
  full_name: string;
  level: number;
}

interface ProjectMetric {
  name: string;
  status: string;
  members_count: number;
  progress: number;
}

function ExecutivePage() {
  const { primaryRole } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectMetric[]>([]);
  const [teamBreakdown, setTeamBreakdown] = useState<{ level: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (primaryRole && primaryRole !== "founder") navigate({ to: "/dashboard" });
  }, [primaryRole, navigate]);

  useEffect(() => {
    fetchExecutiveMetrics();
  }, []);

  const fetchExecutiveMetrics = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.slice(0, 7) + '-01';

      // Fetch headcount
      const { count: headcount } = await (supabase as any)
        .from("profiles")
        .select("*", { count: "exact" });

      // Fetch projects
      const { data: projects } = await (supabase as any)
        .from("projects")
        .select("id, name, status");

      const activeProjects = projects?.filter((p: any) => p.status === "in_progress").length || 0;
      const completedProjects = projects?.filter((p: any) => p.status === "completed").length || 0;
      const onHoldProjects = projects?.filter((p: any) => p.status === "on_hold").length || 0;

      // Fetch recent projects with members
      const { data: projectsWithMembers } = await (supabase as any)
        .from("projects")
        .select("id, name, status, project_members(count)");

      const projectMetrics = (projectsWithMembers || []).slice(0, 5).map((p: any) => ({
        name: p.name,
        status: p.status,
        members_count: p.project_members?.[0]?.count || 0,
        progress: p.status === "completed" ? 100 : p.status === "in_progress" ? 65 : 30,
      }));

      // Fetch team attendance
      const { data: todayAttendance } = await (supabase as any)
        .from("attendance")
        .select("*")
        .eq("date", today)
        .eq("status", "present");

      const teamAttendance = headcount ? Math.round((todayAttendance?.length || 0) / headcount * 100) : 0;

      // Fetch tasks
      const { data: tasks } = await (supabase as any)
        .from("tasks")
        .select("*");

      const completedTasks = tasks?.filter((t: any) => t.status === "completed").length || 0;
      const taskCompletionRate = tasks?.length ? Math.round((completedTasks / tasks.length) * 100) : 0;

      // Fetch payroll
      const { data: payrollData } = await (supabase as any)
        .from("payroll")
        .select("salary");

      const totalPayroll = payrollData?.reduce((sum: number, p: any) => sum + (p.salary || 0), 0) || 0;

      // Count open tasks
      const openTasks = tasks?.filter((t: any) => t.status === "open").length || 0;

      // Team breakdown by level
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("level");

      const breakdown = profiles ? Object.entries(
        profiles.reduce((acc: { [key: number]: number }, p: any) => {
          acc[p.level] = (acc[p.level] || 0) + 1;
          return acc;
        }, {})
      ).map(([level, count]) => ({ level: parseInt(level), count })) : [];

      setMetrics({
        headcount: headcount || 0,
        activeProjects,
        completedProjects,
        onHoldProjects,
        teamAttendance,
        taskCompletionRate,
        totalPayroll,
        openTasks,
      });

      setRecentProjects(projectMetrics);
      setTeamBreakdown(breakdown.sort((a, b) => a.level - b.level));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching executive metrics:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Founder / CEO" title="Executive overview" description="Company-wide KPIs and metrics at a glance." />
        <PageBody>
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader 
        eyebrow="Founder / CEO" 
        title="Executive overview" 
        description="Company-wide KPIs, team health, and strategic metrics." 
      />
      <PageBody>
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard icon={Users} label="Total Headcount" value={metrics?.headcount.toString() || "0"} trend="stable" />
          <KPICard icon={Briefcase} label="Active Projects" value={metrics?.activeProjects.toString() || "0"} trend="up" />
          <KPICard icon={CheckCircle2} label="Task Completion" value={`${metrics?.taskCompletionRate || 0}%`} trend="up" />
          <KPICard icon={Calendar} label="Avg Attendance" value={`${metrics?.teamAttendance || 0}%`} trend={metrics?.teamAttendance! >= 90 ? "up" : "down"} />
        </div>

        {/* Projects & Team Overview */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ProjectsOverview projects={recentProjects} />
          <TeamHealthCard metrics={metrics} />
        </div>

        {/* Detailed Metrics */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Status Breakdown</CardTitle>
              <CardDescription>All projects by status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">In Progress</span>
                <Badge variant="default">{metrics?.activeProjects || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Completed</span>
                <Badge variant="secondary">{metrics?.completedProjects || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">On Hold</span>
                <Badge variant="outline">{metrics?.onHoldProjects || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Management</CardTitle>
              <CardDescription>Overall task status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Open Tasks</span>
                <Badge variant="destructive">{metrics?.openTasks || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Completion Rate</span>
                <Badge variant="default">{metrics?.taskCompletionRate || 0}%</Badge>
              </div>
              <div className="mt-4">
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all" 
                    style={{ width: `${metrics?.taskCompletionRate || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payroll Summary</CardTitle>
              <CardDescription>Monthly cost breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold">{formatCurrency(metrics?.totalPayroll || 0)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics?.headcount || 0} employees
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg: {formatCurrency((metrics?.totalPayroll || 0) / (metrics?.headcount || 1))} / employee
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Levels */}
        {teamBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Breakdown by Level</CardTitle>
              <CardDescription>Organizational hierarchy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamBreakdown.map((level) => (
                  <div key={level.level} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Level {level.level}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-40 h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${(level.count / (metrics?.headcount || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right">{level.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function KPICard({ 
  icon: Icon, 
  label, 
  value, 
  trend 
}: { 
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  trend: "up" | "down" | "stable"
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className={`h-4 w-4 ${trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-gray-500"}`} />
              <span className="text-xs text-muted-foreground">{trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} No change</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-lg bg-secondary text-secondary-foreground grid place-items-center">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectsOverview({ projects }: { projects: ProjectMetric[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Projects</CardTitle>
        <CardDescription>Latest project updates and progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet</p>
          ) : (
            projects.map((project, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{project.name}</h4>
                  <Badge variant={
                    project.status === "completed" ? "default" :
                    project.status === "in_progress" ? "secondary" :
                    "outline"
                  }>
                    {project.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{project.members_count} team members</span>
                  <span>{Math.round(project.progress)}% complete</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      project.status === "completed" ? "bg-green-500" :
                      project.status === "in_progress" ? "bg-blue-500" :
                      "bg-yellow-500"
                    }`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamHealthCard({ metrics }: { metrics: ExecutiveMetrics | null }) {
  const healthScore = Math.round(
    ((metrics?.teamAttendance || 0) * 0.4 +
      (metrics?.taskCompletionRate || 0) * 0.3 +
      Math.min((metrics?.activeProjects || 0) / 2 * 100, 100) * 0.3)
  );

  const getHealthStatus = (score: number) => {
    if (score >= 85) return { label: "Excellent", color: "text-green-600", bg: "bg-green-100" };
    if (score >= 70) return { label: "Good", color: "text-blue-600", bg: "bg-blue-100" };
    if (score >= 50) return { label: "Fair", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { label: "Needs Attention", color: "text-red-600", bg: "bg-red-100" };
  };

  const health = getHealthStatus(healthScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Health Score</CardTitle>
        <CardDescription>Overall organizational health assessment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Health</span>
            <span className={`text-2xl font-bold ${health.color}`}>{healthScore}%</span>
          </div>

          <div className={`rounded-lg p-3 ${health.bg}`}>
            <p className={`text-sm font-medium ${health.color}`}>{health.label}</p>
            <p className={`text-xs ${health.color} opacity-75 mt-1`}>
              Based on attendance, task completion, and project activity
            </p>
          </div>

          <div className="w-full h-4 bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                healthScore >= 85 ? "bg-green-500" :
                healthScore >= 70 ? "bg-blue-500" :
                healthScore >= 50 ? "bg-yellow-500" :
                "bg-red-500"
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-muted-foreground">Attendance</p>
              <p className="font-semibold">{metrics?.teamAttendance || 0}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Task Rate</p>
              <p className="font-semibold">{metrics?.taskCompletionRate || 0}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
