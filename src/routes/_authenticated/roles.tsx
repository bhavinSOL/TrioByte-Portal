import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth, type AppRole, roleLabel } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "../../integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({ meta: [{ title: "Roles & Access — TrioByte Portal" }] }),
  component: RolesPage,
});

interface UserWithRoles {
  id: string;
  full_name: string | null;
  email: string | null;
  level: number;
  roles: AppRole[];
  is_blocked: boolean;
}

function RolesPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("employee");
  const [isAdding, setIsAdding] = useState(false);
  const [updatingLevel, setUpdatingLevel] = useState<string | null>(null);
  const [levelValues, setLevelValues] = useState<Record<string, string>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, level, is_blocked")
        .order("full_name");

      if (!profiles) {
        setUsers([]);
        return;
      }

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        profiles.map(async (p: any) => {
          const { data: rolesData } = await (supabase as any)
            .from("user_roles")
            .select("role")
            .eq("user_id", p.id);
          return {
            ...p,
            roles: (rolesData || []).map((r: { role: AppRole }) => r.role),
          };
        })
      );

      setUsers(usersWithRoles);
      // Initialize level values
      const levels: Record<string, string> = {};
      usersWithRoles.forEach((u: UserWithRoles) => {
        levels[u.id] = u.level.toString();
      });
      setLevelValues(levels);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  const addRole = async () => {
    if (!selectedUser) return;

    try {
      setIsAdding(true);
      const user = users.find(u => u.id === selectedUser);
      if (user?.roles.includes(newRole)) {
        toast.error("User already has this role");
        return;
      }

      const { error } = await (supabase as any)
        .from("user_roles")
        .insert({
          user_id: selectedUser,
          role: newRole,
        });

      if (error) throw error;
      toast.success("Role added");
      setIsDialogOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await (supabase as any)
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;
      toast.success("Role removed");
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateLevel = async (userId: string) => {
    const level = parseInt(levelValues[userId] || "1");
    if (level < 1 || level > 5) {
      toast.error("Level must be between 1 and 5");
      return;
    }

    try {
      setUpdatingLevel(userId);
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ level })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Level updated");
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdatingLevel(null);
    }
  };

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    // Check if trying to block founder
    const user = users.find(u => u.id === userId);
    if (!isBlocked && user?.roles.includes("founder")) {
      toast.error("Cannot block Founder/CEO");
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ is_blocked: !isBlocked })
        .eq("id", userId);

      if (error) throw error;
      toast.success(isBlocked ? "Employee unblocked" : "Employee blocked");
      await loadUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Roles & access" description="Manage user roles and access levels." />
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
      <PageHeader title="Roles & access" description="Manage user roles and access levels." />
      <PageBody>
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{user.full_name || "—"}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Level {user.level}</Badge>
                      {user.is_blocked && <Badge variant="destructive">Blocked</Badge>}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Current roles</div>
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      ) : (
                        user.roles.map((role) => (
                          <Badge key={role} className="flex items-center gap-2">
                            {roleLabel(role)}
                            <button
                              onClick={() => removeRole(user.id, role)}
                              className="ml-1 hover:opacity-70"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`level-${user.id}`}>Level</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id={`level-${user.id}`}
                          type="number"
                          min="1"
                          max="5"
                          value={levelValues[user.id] || "1"}
                          onChange={(e) => setLevelValues(prev => ({ ...prev, [user.id]: e.target.value }))}
                        />
                        <Button
                          onClick={() => updateLevel(user.id)}
                          disabled={updatingLevel === user.id}
                          size="sm"
                        >
                          {updatingLevel === user.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          Update
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">1-5 (1=bronze, 5=diamond)</p>
                    </div>
                    <div>
                      <Dialog open={isDialogOpen && selectedUser === user.id} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (open) setSelectedUser(user.id);
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="w-full mt-6">
                            <Plus className="mr-2 h-4 w-4" />
                            Add role
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add role</DialogTitle>
                            <DialogDescription>Assign a new role to {user.full_name}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="role">Role</Label>
                              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="hr_admin">HR Admin</SelectItem>
                                  <SelectItem value="founder">Founder</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button onClick={addRole} disabled={isAdding}>
                              {isAdding && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                              Add role
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      {!user.roles.includes("founder") && (
                        <Button
                          size="sm"
                          variant={user.is_blocked ? "default" : "outline"}
                          className="w-full mt-2"
                          onClick={() => toggleBlock(user.id, user.is_blocked)}
                        >
                          {user.is_blocked ? "🔓 Unblock" : "🔒 Block"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageBody>
    </>
  );
}
