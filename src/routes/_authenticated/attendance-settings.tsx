import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "../../components/portal/page-header";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/attendance-settings")({
  head: () => ({ meta: [{ title: "Attendance Settings — TrioByte Portal" }] }),
  component: AttendanceSettingsPage,
});

function AttendanceSettingsPage() {
  const { primaryRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  if (primaryRole !== "hr_admin" && primaryRole !== "founder") {
    return (
      <PageBody>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </PageBody>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance Settings"
        description="Configure working hours and attendance policies."
      />
      <PageBody>
        <Tabs defaultValue="working-hours" className="space-y-4">
          <TabsList>
            <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
            <TabsTrigger value="policies">Policies</TabsTrigger>
          </TabsList>

          <TabsContent value="working-hours" className="space-y-4">
            <WorkingHoursSettings />
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <PoliciesSettings />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

function WorkingHoursSettings() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<{ [key: string]: { start: string; end: string } }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (profiles) {
        setEmployees(profiles);
        // Load working hours for each
        const hours: { [key: string]: { start: string; end: string } } = {};
        for (const profile of profiles) {
          const { data: prefs } = await (supabase as any)
            .from("user_preferences")
            .select("work_start_time, work_end_time")
            .eq("user_id", profile.id)
            .maybeSingle();

          hours[profile.id] = {
            start: prefs?.work_start_time || "09:00",
            end: prefs?.work_end_time || "18:00",
          };
        }
        setWorkingHours(hours);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const saveWorkingHours = async (userId: string) => {
    try {
      setSaving(true);
      const hours = workingHours[userId];

      const { error } = await (supabase as any)
        .from("user_preferences")
        .upsert({
          user_id: userId,
          work_start_time: hours.start,
          work_end_time: hours.end,
        });

      if (error) throw error;
      toast.success("Working hours updated");
      setExpandedUser(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Working Hours</CardTitle>
        <CardDescription>Set custom working hours for each employee. Hours will be used for automatic logout.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {employees.map((emp) => (
            <div key={emp.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{emp.full_name}</h4>
                  <p className="text-sm text-muted-foreground">{emp.email}</p>
                </div>
                {expandedUser === emp.id ? null : (
                  <div className="text-sm text-muted-foreground">
                    {workingHours[emp.id]?.start} - {workingHours[emp.id]?.end}
                  </div>
                )}
              </div>

              {expandedUser === emp.id && (
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t">
                  <div>
                    <Label htmlFor={`start-${emp.id}`} className="text-xs">Start Time</Label>
                    <Input
                      id={`start-${emp.id}`}
                      type="time"
                      value={workingHours[emp.id]?.start || "09:00"}
                      onChange={(e) =>
                        setWorkingHours({
                          ...workingHours,
                          [emp.id]: { ...workingHours[emp.id], start: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`end-${emp.id}`} className="text-xs">End Time</Label>
                    <Input
                      id={`end-${emp.id}`}
                      type="time"
                      value={workingHours[emp.id]?.end || "18:00"}
                      onChange={(e) =>
                        setWorkingHours({
                          ...workingHours,
                          [emp.id]: { ...workingHours[emp.id], end: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {expandedUser === emp.id ? (
                  <>
                    <Button size="sm" onClick={() => saveWorkingHours(emp.id)} disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setExpandedUser(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setExpandedUser(emp.id)}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PoliciesSettings() {
  const [autoLogout, setAutoLogout] = useState(true);
  const [autoLogin, setAutoLogin] = useState(true);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Policies</CardTitle>
        <CardDescription>Configure automatic attendance tracking behaviors.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={(e) => setAutoLogin(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto-login on app access</span>
          </Label>
          <p className="text-sm text-muted-foreground ml-6">Automatically mark employees as present when they access the portal.</p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLogout}
              onChange={(e) => setAutoLogout(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Auto-logout at end of working hours</span>
          </Label>
          <p className="text-sm text-muted-foreground ml-6">Automatically log out employees who don't manually log out after their working hours end.</p>
        </div>

        <Button className="mt-4">Save Policies</Button>
      </CardContent>
    </Card>
  );
}
