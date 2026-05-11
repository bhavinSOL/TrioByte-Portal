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
import { Loader2, Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave Requests — TrioByte Portal" }] }),
  component: LeaveRequestsPage,
});

const leaveSchema = z.object({
  leave_type: z.string().min(1, "Select leave type"),
  start_date: z.string().min(1, "Select start date"),
  end_date: z.string().min(1, "Select end date"),
  reason: z.string().min(3, "Reason is required"),
});

interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null };
}

function LeaveRequestsPage() {
  const { profile, primaryRole, refresh } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, [profile?.id, primaryRole]);

  const loadRequests = async () => {
    try {
      if (primaryRole === "employee") {
        // Employees see only their requests
        const { data } = await (supabase as any)
          .from("leave_requests")
          .select("*")
          .eq("user_id", profile?.id)
          .order("created_at", { ascending: false });
        setRequests(data || []);
      } else {
        // HR/Admins see all requests
        const { data } = await (supabase as any)
          .from("leave_requests")
          .select("*")
          .order("created_at", { ascending: false });

        // Manually fetch profile names
        if (data) {
          const enrichedData = await Promise.all(
            data.map(async (req: any) => {
              const { data: profile } = await (supabase as any)
                .from("profiles")
                .select("full_name")
                .eq("id", req.user_id)
                .maybeSingle();
              return { ...req, profiles: profile };
            })
          );
          setRequests(enrichedData);
        }
      }
    } catch (error) {
      // Table might not exist yet
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leaveSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    try {
      setSubmitting(true);
      const { error } = await (supabase as any)
        .from("leave_requests")
        .insert({
          user_id: profile?.id,
          ...parsed.data,
        });

      if (error) throw error;
      toast.success("Leave request submitted");
      setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
      setIsDialogOpen(false);
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const approveRequest = async (id: string) => {
    try {
      setActioningId(id);
      const { error } = await (supabase as any)
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Leave request approved");
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActioningId(null);
    }
  };

  const rejectRequest = async (id: string) => {
    if (!rejectionReason) return toast.error("Provide rejection reason");

    try {
      setActioningId(id);
      const { error } = await (supabase as any)
        .from("leave_requests")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Leave request rejected");
      setShowRejectDialog(null);
      setRejectionReason("");
      await loadRequests();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setActioningId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getDayCount = (start: string, end: string) => {
    if (!start || !end) return 0;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Leave requests" description="Request and manage employee leave." />
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
        title="Leave requests"
        description={primaryRole === "employee" ? "View and manage your leave requests." : "Approve or reject employee leave applications."}
        actions={
          primaryRole === "employee" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Request leave</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request leave</DialogTitle>
                  <DialogDescription>Submit a leave request for approval.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="type">Leave type</Label>
                    <Select value={form.leave_type} onValueChange={(v) => setForm(prev => ({ ...prev, leave_type: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="sick">Sick</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="start">Start date</Label>
                      <Input
                        id="start"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="end">End date</Label>
                      <Input
                        id="end"
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Input
                      id="reason"
                      value={form.reason}
                      onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Why are you requesting leave?"
                      required
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit request
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <PageBody>
        {requests.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-12">
              {primaryRole === "employee" ? "No leave requests yet" : "No pending requests"}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <Card key={req.id}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        {primaryRole !== "employee" && (
                          <div className="text-sm font-medium mb-1">{req.profiles?.full_name || "—"}</div>
                        )}
                        <div className="text-lg font-semibold">{req.leave_type.replace('_', ' ')}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(req.start_date)} - {formatDate(req.end_date)} ({getDayCount(req.start_date, req.end_date)} days)
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        req.status === "approved" ? "bg-green-100 text-green-800" :
                        req.status === "rejected" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>
                        {req.status}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Reason</div>
                      <div className="text-sm font-medium">{req.reason}</div>
                    </div>

                    {req.status === "rejected" && (
                      <div className="rounded-md bg-red-50 p-3 text-sm">
                        <div className="font-medium text-red-900">Rejection reason</div>
                        <div className="text-red-800 mt-1">{req.rejection_reason || "—"}</div>
                      </div>
                    )}

                    {primaryRole !== "employee" && req.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveRequest(req.id)}
                          disabled={actioningId === req.id}
                        >
                          {actioningId === req.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Dialog open={showRejectDialog === req.id} onOpenChange={(open) => setShowRejectDialog(open ? req.id : null)}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Reject leave request</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="reject_reason">Reason for rejection</Label>
                                <Input
                                  id="reject_reason"
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  placeholder="Explain why you're rejecting this request"
                                />
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setShowRejectDialog(null)}>Cancel</Button>
                                <Button
                                  onClick={() => rejectRequest(req.id)}
                                  disabled={actioningId === req.id}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  {actioningId === req.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                  Reject
                                </Button>
                              </DialogFooter>
                            </div>
                          </DialogContent>
                        </Dialog>
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
