import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "../../integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks & Deadlines — TrioByte Portal" }] }),
  component: TasksPage,
});

const taskSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().optional(),
  assigned_to: z.string().min(1, "Select assignee"),
  priority: z.string(),
  due_date: z.string().optional(),
});

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
  profiles?: { full_name: string | null };
}

interface Employee {
  id: string;
  full_name: string | null;
}

function TasksPage() {
  const { profile, primaryRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    priority: "medium",
    due_date: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    loadTasks();
    if (primaryRole !== "employee") {
      loadEmployees();
    }
  }, [profile?.id, primaryRole]);

  const loadTasks = async () => {
    try {
      if (primaryRole === "employee") {
        // Employees see only their tasks
        const { data } = await (supabase as any)
          .from("tasks")
          .select("*")
          .eq("assigned_to", profile?.id)
          .order("due_date", { ascending: true, nullsFirst: false });
        setTasks(data || []);
      } else {
        // HR/Admins see all tasks
        const { data } = await (supabase as any)
          .from("tasks")
          .select("*, profiles(full_name)")
          .order("due_date", { ascending: true, nullsFirst: false });
        setTasks(data || []);
      }
    } catch (error) {
      // Table might not exist yet
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .not("id", "eq", profile?.id)
        .order("full_name");
      setEmployees(data || []);
    } catch (error) {
      // Ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = taskSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    try {
      setSubmitting(true);
      const { error } = await (supabase as any)
        .from("tasks")
        .insert({
          created_by: profile?.id,
          assigned_to: parsed.data.assigned_to,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: parsed.data.priority,
          due_date: parsed.data.due_date || null,
          status: "open",
        });

      if (error) throw error;
      toast.success("Task created");
      setForm({ title: "", description: "", assigned_to: "", priority: "medium", due_date: "" });
      setIsDialogOpen(false);
      await loadTasks();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateTaskStatus = async (id: string, status: string) => {
    try {
      setActioningId(id);
      const { error } = await (supabase as any)
        .from("tasks")
        .update({
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Task marked as ${status}`);
      await loadTasks();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const filteredTasks = filterStatus === "all" ? tasks : tasks.filter(t => t.status === filterStatus);

  const stats = {
    total: tasks.length,
    open: tasks.filter(t => t.status === "open").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Tasks & deadlines" description="Assign work and track progress." />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tasks & deadlines"
        description={primaryRole === "employee" ? "View your assigned tasks and deadlines." : "Assign work and track progress."}
        actions={
          primaryRole !== "employee" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Create task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create new task</DialogTitle>
                  <DialogDescription>Assign a task to a team member.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task title</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="What needs to be done?"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="desc">Description (optional)</Label>
                    <Input
                      id="desc"
                      value={form.description}
                      onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Add details"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="assignee">Assign to</Label>
                      <Select value={form.assigned_to} onValueChange={(v) => setForm(prev => ({ ...prev, assigned_to: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.full_name || "—"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="due">Due date (optional)</Label>
                    <Input
                      id="due"
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create task
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <PageBody>
        {tasks.length > 0 && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className={filterStatus === "all" ? "ring-2 ring-primary" : ""}>
              <CardContent className="pt-6">
                <div className="text-xs font-medium uppercase text-muted-foreground">Total tasks</div>
                <div className="mt-2 text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className={filterStatus === "open" ? "ring-2 ring-primary" : ""} onClick={() => setFilterStatus("open")} role="button">
              <CardContent className="pt-6">
                <div className="text-xs font-medium uppercase text-muted-foreground">Open</div>
                <div className="mt-2 text-2xl font-bold">{stats.open}</div>
              </CardContent>
            </Card>
            <Card className={filterStatus === "in_progress" ? "ring-2 ring-primary" : ""} onClick={() => setFilterStatus("in_progress")} role="button">
              <CardContent className="pt-6">
                <div className="text-xs font-medium uppercase text-muted-foreground">In progress</div>
                <div className="mt-2 text-2xl font-bold">{stats.inProgress}</div>
              </CardContent>
            </Card>
            <Card className={filterStatus === "completed" ? "ring-2 ring-primary" : ""} onClick={() => setFilterStatus("completed")} role="button">
              <CardContent className="pt-6">
                <div className="text-xs font-medium uppercase text-muted-foreground">Completed</div>
                <div className="mt-2 text-2xl font-bold">{stats.completed}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-12">
              {primaryRole === "employee" ? "No tasks assigned yet" : "No tasks"}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        {primaryRole !== "employee" && (
                          <div className="text-sm text-muted-foreground mt-2">Assigned to: {task.profiles?.full_name || "—"}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          task.priority === "urgent" ? "bg-red-100 text-red-800" :
                          task.priority === "high" ? "bg-orange-100 text-orange-800" :
                          task.priority === "medium" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {task.priority}
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          task.status === "completed" ? "bg-green-100 text-green-800" :
                          task.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {task.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    {task.due_date && (
                      <div className={`flex items-center gap-2 text-sm ${isOverdue(task.due_date) && task.status !== "completed" ? "text-red-600" : "text-muted-foreground"}`}>
                        {isOverdue(task.due_date) && task.status !== "completed" && <AlertCircle className="h-4 w-4" />}
                        <Clock className="h-4 w-4" />
                        Due: {formatDate(task.due_date)}
                      </div>
                    )}

                    {task.status !== "completed" && (
                      <div className="flex gap-2">
                        {task.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateTaskStatus(task.id, "in_progress")}
                            disabled={actioningId === task.id}
                          >
                            {actioningId === task.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            <Clock className="mr-2 h-4 w-4" />
                            Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, "completed")}
                          disabled={actioningId === task.id}
                        >
                          {actioningId === task.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Complete
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
