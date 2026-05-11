import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "../../integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit2, Calendar, Users, Briefcase } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — TrioByte Portal" }] }),
  component: ProjectsPage,
});

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  created_by: string;
  created_at: string;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  responsibility: string | null;
  allocation_percentage: number;
  joined_date: string;
  status: string;
  profiles?: { full_name: string | null };
}

interface ProjectWithMembers extends Project {
  project_members?: ProjectMember[];
}

function ProjectsPage() {
  const { profile, primaryRole } = useAuth();
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithMembers | null>(null);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "planning",
    start_date: "",
    end_date: "",
    budget: "",
  });

  const [memberForm, setMemberForm] = useState({
    user_id: "",
    role: "developer",
    responsibility: "",
    allocation_percentage: "100",
  });

  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, [profile?.id]);

  const loadProjects = async () => {
    try {
      let projectsData: Project[] = [];

      if (primaryRole === "employee") {
        // Employees only see projects they're assigned to
        const { data: membershipData } = await (supabase as any)
          .from("project_members")
          .select("project_id")
          .eq("user_id", profile?.id)
          .eq("status", "active");

        if (membershipData && membershipData.length > 0) {
          const projectIds = membershipData.map((m: any) => m.project_id);
          const { data } = await (supabase as any)
            .from("projects")
            .select("*")
            .in("id", projectIds)
            .order("created_at", { ascending: false });
          projectsData = data || [];
        }
      } else {
        // Admins/Founders see all projects
        const { data } = await (supabase as any)
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
        projectsData = data || [];
      }

      // Enrich with project members
      if (projectsData && projectsData.length > 0) {
        const enrichedData = await Promise.all(
          projectsData.map(async (project: Project) => {
            const { data: members } = await (supabase as any)
              .from("project_members")
              .select("*")
              .eq("project_id", project.id)
              .eq("status", "active");

            // Get profile names
            const enrichedMembers = await Promise.all(
              (members || []).map(async (member: any) => {
                const { data: profileData } = await (supabase as any)
                  .from("profiles")
                  .select("full_name")
                  .eq("id", member.user_id)
                  .maybeSingle();
                return { ...member, profiles: profileData };
              })
            );

            return { ...project, project_members: enrichedMembers };
          })
        );
        setProjects(enrichedData);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      setAllEmployees(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await (supabase as any)
        .from("projects")
        .insert({
          name: formData.name,
          description: formData.description,
          status: formData.status,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          budget: formData.budget ? parseFloat(formData.budget) : null,
          created_by: profile?.id,
        });

      if (error) throw error;
      toast.success("Project created successfully");
      setFormData({
        name: "",
        description: "",
        status: "planning",
        start_date: "",
        end_date: "",
        budget: "",
      });
      setIsDialogOpen(false);
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!memberForm.user_id || !selectedProject) {
      toast.error("Select an employee");
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await (supabase as any)
        .from("project_members")
        .insert({
          project_id: selectedProject.id,
          user_id: memberForm.user_id,
          role: memberForm.role,
          responsibility: memberForm.responsibility,
          allocation_percentage: parseInt(memberForm.allocation_percentage),
        });

      if (error) throw error;
      toast.success("Team member added");
      setMemberForm({
        user_id: "",
        role: "developer",
        responsibility: "",
        allocation_percentage: "100",
      });
      setShowMemberDialog(false);
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      setIsSaving(true);
      const { error } = await (supabase as any)
        .from("project_members")
        .update({ status: "removed", left_date: new Date().toISOString().split("T")[0] })
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Team member removed");
      await loadProjects();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const canManageProject = (project: Project) => {
    return project.created_by === profile?.id || primaryRole === "hr_admin" || primaryRole === "founder";
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Projects" description="Manage and track projects with team members." />
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
        title="Projects"
        description="Manage and track projects with team members."
        actions={
          (primaryRole === "hr_admin" || primaryRole === "founder") && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>Add a new project and start managing your team.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Mobile App v2.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Project overview"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="budget">Budget</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Project
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <PageBody>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-12">
              No projects yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="mt-2">{project.description}</CardDescription>
                      )}
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      project.status === "completed"
                        ? "bg-green-100 text-green-800"
                        : project.status === "in_progress"
                        ? "bg-blue-100 text-blue-800"
                        : project.status === "on_hold"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {project.status.replace("_", " ")}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    {project.start_date && (
                      <div>
                        <span className="text-muted-foreground">Start Date:</span>
                        <div className="font-medium">{new Date(project.start_date + "T00:00:00").toLocaleDateString()}</div>
                      </div>
                    )}
                    {project.end_date && (
                      <div>
                        <span className="text-muted-foreground">End Date:</span>
                        <div className="font-medium">{new Date(project.end_date + "T00:00:00").toLocaleDateString()}</div>
                      </div>
                    )}
                    {project.budget && (
                      <div>
                        <span className="text-muted-foreground">Budget:</span>
                        <div className="font-medium">₹{project.budget.toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Team Members ({project.project_members?.length || 0})
                      </h4>
                      {canManageProject(project) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedProject(project);
                            setShowMemberDialog(true);
                          }}
                        >
                          <Plus className="mr-2 h-3 w-3" />
                          Add Member
                        </Button>
                      )}
                    </div>

                    {project.project_members && project.project_members.length > 0 ? (
                      <div className="space-y-2">
                        {project.project_members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{member.profiles?.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.role} • {member.allocation_percentage}%
                              </p>
                              {member.responsibility && (
                                <p className="text-xs text-muted-foreground mt-1">{member.responsibility}</p>
                              )}
                            </div>
                            {canManageProject(project) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No team members added yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      {/* Add Member Dialog */}
      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>Add an employee to the project with their role and responsibilities.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee">Employee</Label>
              <Select value={memberForm.user_id} onValueChange={(v) => setMemberForm({ ...memberForm, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {allEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={memberForm.role} onValueChange={(v) => setMemberForm({ ...memberForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="qa">QA</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="responsibility">Responsibility</Label>
              <Input
                id="responsibility"
                value={memberForm.responsibility}
                onChange={(e) => setMemberForm({ ...memberForm, responsibility: e.target.value })}
                placeholder="e.g. Backend API development"
              />
            </div>
            <div>
              <Label htmlFor="allocation">Allocation %</Label>
              <Input
                id="allocation"
                type="number"
                min="0"
                max="100"
                value={memberForm.allocation_percentage}
                onChange={(e) => setMemberForm({ ...memberForm, allocation_percentage: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
