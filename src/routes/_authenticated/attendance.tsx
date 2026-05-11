import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Calendar, Clock, ChevronLeft, ChevronRight, Edit2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { updateAttendanceRecord, updateUserWorkingHours, getUserWorkingHours } from "@/lib/attendance-service";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — TrioByte Portal" }] }),
  component: AttendancePage,
});

interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  login_time: string | null;
  logout_time: string | null;
  status: string;
  profiles?: { full_name: string | null };
}

function AttendancePage() {
  const { profile, primaryRole } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(loadAttendance, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [profile?.id, selectedDate]);

  const loadAttendance = async () => {
    try {
      if (primaryRole === "employee") {
        // Employee view - their own 30-day history
        const { data } = await (supabase as any)
          .from("attendance")
          .select("*")
          .eq("user_id", profile?.id)
          .order("date", { ascending: false })
          .limit(30);

        setRecords(data || []);
        const today = data?.find((r: AttendanceRecord) => r.date === currentDate);
        setTodayRecord(today || null);
      } else {
        // Admin/Founder view - all employees for selected date
        const { data } = await (supabase as any)
          .from("attendance")
          .select("*")
          .eq("date", selectedDate)
          .order("login_time", { ascending: false });

        // Fetch profile names separately
        if (data && data.length > 0) {
          const enrichedData = await Promise.all(
            data.map(async (record: any) => {
              const { data: profileData } = await (supabase as any)
                .from("profiles")
                .select("full_name")
                .eq("id", record.user_id)
                .maybeSingle();
              return { ...record, profiles: profileData };
            })
          );
          setRecords(enrichedData);
        } else {
          setRecords(data || []);
        }
        setTodayRecord(null);
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const now = new Date().toISOString();

      if (todayRecord) {
        toast.error("Already logged in today");
        return;
      }

      const { error } = await (supabase as any)
        .from("attendance")
        .insert({
          user_id: profile?.id,
          date: currentDate,
          login_time: now,
          status: "present",
        });

      if (error) throw error;
      toast.success("Logged in successfully");
      await loadAttendance();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingIn(true);
      const now = new Date().toISOString();

      if (!todayRecord) {
        toast.error("You haven't logged in today");
        return;
      }

      const { error } = await (supabase as any)
        .from("attendance")
        .update({ logout_time: now })
        .eq("id", todayRecord.id);

      if (error) throw error;
      toast.success("Logged out successfully");
      await loadAttendance();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "—";
    return new Date(time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getTodayWorkHours = () => {
    if (!todayRecord?.login_time) return "—";
    if (!todayRecord?.logout_time) return "Still logged in";
    const login = new Date(todayRecord.login_time).getTime();
    const logout = new Date(todayRecord.logout_time).getTime();
    const hours = ((logout - login) / (1000 * 60 * 60)).toFixed(1);
    return `${hours}h`;
  };

  const getWorkHours = (record: AttendanceRecord) => {
    if (!record.login_time) return "—";
    if (!record.logout_time) return "Still logged in";
    const login = new Date(record.login_time).getTime();
    const logout = new Date(record.logout_time).getTime();
    const hours = ((logout - login) / (1000 * 60 * 60)).toFixed(1);
    return `${hours}h`;
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate + "T00:00:00");
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  // Admin edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLogin, setEditLogin] = useState("");
  const [editLogout, setEditLogout] = useState("");
  const [workingHours, setWorkingHours] = useState<{ start: string; end: string }>({ start: "09:00", end: "18:00" });
  const [editingHours, setEditingHours] = useState(false);
  const [hoursForUser, setHoursForUser] = useState<string | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHeader title="Attendance" description={primaryRole === "employee" ? "Track your daily login and logout times." : "View employee attendance by day."} />
        <PageBody>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PageBody>
      </>
    );
  }

  const startEditRecord = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setEditLogin(record.login_time?.split('T')[1]?.slice(0, 5) || "");
    setEditLogout(record.logout_time?.split('T')[1]?.slice(0, 5) || "");
  };

  const saveEditRecord = async (record: AttendanceRecord) => {
    try {
      const loginISO = editLogin ? new Date(record.date + "T" + editLogin + ":00").toISOString() : null;
      const logoutISO = editLogout ? new Date(record.date + "T" + editLogout + ":00").toISOString() : null;

      const success = await updateAttendanceRecord(record.id, {
        login_time: loginISO || undefined,
        logout_time: logoutISO || undefined,
      });

      if (success) {
        toast.success("Attendance updated");
        setEditingId(null);
        await loadAttendance();
      } else {
        toast.error("Failed to update attendance");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const saveWorkingHours = async (userId: string) => {
    try {
      const success = await updateUserWorkingHours(userId, workingHours.start, workingHours.end);
      if (success) {
        toast.success("Working hours updated");
        setEditingHours(false);
        setHoursForUser(null);
      } else {
        toast.error("Failed to update working hours");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const loadHoursForUser = async (userId: string) => {
    const hours = await getUserWorkingHours(userId);
    if (hours) {
      setWorkingHours({ start: hours.start_time, end: hours.end_time });
      setHoursForUser(userId);
      setEditingHours(true);
    }
  };

  if (primaryRole === "employee") {
    return (
      <>
        <PageHeader title="Attendance" description="Track your daily login and logout times." />
        <PageBody>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today's Attendance</CardTitle>
              <CardDescription>{formatDate(currentDate)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Login time</div>
                  <div className="mt-2 text-2xl font-semibold">{formatTime(todayRecord?.login_time)}</div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Logout time</div>
                  <div className="mt-2 text-2xl font-semibold">{formatTime(todayRecord?.logout_time)}</div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Hours worked</div>
                  <div className="mt-2 text-2xl font-semibold">{getTodayWorkHours()}</div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleLogin} disabled={isLoggingIn || !!todayRecord?.login_time}>
                  {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Clock className="mr-2 h-4 w-4" />
                  Log in
                </Button>
                <Button onClick={handleLogout} variant="outline" disabled={isLoggingIn || !todayRecord?.login_time || !!todayRecord?.logout_time}>
                  {isLoggingIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Clock className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance History</CardTitle>
              <CardDescription>Last 30 days of attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-2 py-2">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-2 py-2">Login</th>
                      <th className="text-left font-medium text-muted-foreground px-2 py-2">Logout</th>
                      <th className="text-left font-medium text-muted-foreground px-2 py-2">Hours</th>
                      <th className="text-left font-medium text-muted-foreground px-2 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          No attendance records yet
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr key={record.id} className="border-b border-border/50 hover:bg-muted/50">
                          <td className="px-2 py-3 font-medium">{formatDate(record.date)}</td>
                          <td className="px-2 py-3">{formatTime(record.login_time)}</td>
                          <td className="px-2 py-3">{formatTime(record.logout_time)}</td>
                          <td className="px-2 py-3">{getWorkHours(record)}h</td>
                          <td className="px-2 py-3">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              record.status === "present" ? "bg-green-100 text-green-800" :
                              record.status === "leave" ? "bg-blue-100 text-blue-800" :
                              record.status === "half_day" ? "bg-yellow-100 text-yellow-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {record.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  // Admin view - Day-wise attendance
  return (
    <>
      <PageHeader
        title="Attendance"
        description="View and manage employee attendance records."
      />
      <PageBody>
        {editingHours && hoursForUser && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base">Edit Working Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={workingHours.start}
                    onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={workingHours.end}
                    onChange={(e) => setWorkingHours({ ...workingHours, end: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => saveWorkingHours(hoursForUser)} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button onClick={() => { setEditingHours(false); setHoursForUser(null); }} size="sm" variant="outline">
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance for {formatDate(selectedDate)}</CardTitle>
            <div className="flex items-center gap-2 mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeDate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center text-sm font-medium">{formatDate(selectedDate)}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeDate(1)}
                disabled={selectedDate === currentDate}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Employee</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Login</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Logout</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Hours</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No attendance records for this date
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="px-2 py-3 font-medium">{record.profiles?.full_name || "Unknown"}</td>
                        <td className="px-2 py-3">
                          {editingId === record.id ? (
                            <Input
                              type="time"
                              value={editLogin}
                              onChange={(e) => setEditLogin(e.target.value)}
                              className="w-24 h-8"
                            />
                          ) : (
                            formatTime(record.login_time)
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {editingId === record.id ? (
                            <Input
                              type="time"
                              value={editLogout}
                              onChange={(e) => setEditLogout(e.target.value)}
                              className="w-24 h-8"
                            />
                          ) : (
                            formatTime(record.logout_time)
                          )}
                        </td>
                        <td className="px-2 py-3">{getWorkHours(record)}</td>
                        <td className="px-2 py-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            record.status === "present" ? "bg-green-100 text-green-800" :
                            record.status === "leave" ? "bg-blue-100 text-blue-800" :
                            record.status === "half_day" ? "bg-yellow-100 text-yellow-800" :
                            "bg-gray-100 text-gray-800"
                          }`}>
                            {record.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex gap-1">
                            {editingId === record.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => saveEditRecord(record)}
                                  className="h-7 px-2"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                  className="h-7 px-2"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditRecord(record)}
                                  className="h-7 px-2"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => loadHoursForUser(record.user_id)}
                                  className="h-7 px-2"
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
