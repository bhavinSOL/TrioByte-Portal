import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "../../integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interns")({
  head: () => ({ meta: [{ title: "Interns — TrioByte Portal" }] }),
  component: InternsPage,
});

interface Intern {
  id: string;
  user_id: string;
  institution: string | null;
  field_of_study: string | null;
  start_date: string;
  end_date: string;
  mentor_id: string | null;
  status: string;
  performance_rating: number | null;
  profiles?: { full_name: string | null };
  mentor_profile?: { full_name: string | null };
}

interface Employee {
  id: string;
  full_name: string | null;
}

function InternsPage() {
  const { profile, primaryRole } = useAuth();
  const [interns, setInterns] = useState<Intern[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    institution: "",
    field_of_study: "",
    start_date: "",
    end_date: "",
    mentor_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState("3");

  useEffect(() => {
    loadInterns();
    if (primaryRole !== "employee") {
      loadEmployees();
    }
  }, [primaryRole]);

  const loadInterns = async () => {
    try {
      const { data } = await (supabase as any)
        .from("interns")
        .select("*, profiles(full_name), mentor_profile:profiles!mentor_id(full_name)")
        .order("start_date", { ascending: false });
      setInterns(data || []);
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
        .order("full_name");
      setEmployees(data || []);
    } catch (error) {
      // Ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.start_date || !form.end_date) {
      return toast.error("Fill required fields");
    }

    try {
      setSubmitting(true);
      const { error } = await (supabase as any)
        .from("interns")
        .insert({
          user_id: form.user_id,
          institution: form.institution,
          field_of_study: form.field_of_study,
          start_date: form.start_date,
          end_date: form.end_date,
          mentor_id: form.mentor_id || null,
          status: "active",
        });

      if (error) throw error;
      toast.success("Intern added");
      setForm({ user_id: "", institution: "", field_of_study: "", start_date: "", end_date: "", mentor_id: "" });
      setIsDialogOpen(false);
      await loadInterns();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateRating = async (internId: string) => {
    const rating = parseInt(ratingValue);
    if (rating < 1 || rating > 5) {
      toast.error("Rating must be between 1 and 5");
      return;
    }

    try {
      setRatingId(internId);
      const { error } = await (supabase as any)
        .from("interns")
        .update({ performance_rating: rating })
        .eq("id", internId);

      if (error) throw error;
      toast.success("Rating updated");
      await loadInterns();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRatingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getDuration = (start: string, end: string) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const months = Math.round((e - s) / (1000 * 60 * 60 * 24 * 30));
    return `${months} months`;
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Intern management" description="Track intern details and progress." />
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
        title="Intern management"
        description={primaryRole === "employee" ? "View your internship details." : "Track intern details and assign mentors."}
        actions={
          primaryRole !== "employee" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add intern</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add new intern</DialogTitle>
                  <DialogDescription>Onboard an intern and assign a mentor.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="user">Intern</Label>
                    <Select value={form.user_id} onValueChange={(v) => setForm(prev => ({ ...prev, user_id: v }))}>
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="inst">Institution</Label>
                      <Input
                        id="inst"
                        value={form.institution}
                        onChange={(e) => setForm(prev => ({ ...prev, institution: e.target.value }))}
                        placeholder="College name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="field">Field of study</Label>
                      <Input
                        id="field"
                        value={form.field_of_study}
                        onChange={(e) => setForm(prev => ({ ...prev, field_of_study: e.target.value }))}
                        placeholder="Major"
                      />
                    </div>
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
                    <Label htmlFor="mentor">Mentor (optional)</Label>
                    <Select value={form.mentor_id || "none"} onValueChange={(v) => setForm(prev => ({ ...prev, mentor_id: v === "none" ? "" : v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Assign mentor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No mentor</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.full_name || "—"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add intern
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <PageBody>
        {interns.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-12">
              No interns yet
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {interns.map((intern) => (
              <Card key={intern.id}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{intern.profiles?.full_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{intern.institution}</div>
                      </div>
                      <Badge className={intern.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {intern.status}
                      </Badge>
                    </div>

                    <div className="text-sm space-y-1">
                      <div><span className="text-muted-foreground">Field:</span> {intern.field_of_study || "—"}</div>
                      <div><span className="text-muted-foreground">Duration:</span> {getDuration(intern.start_date, intern.end_date)}</div>
                      <div><span className="text-muted-foreground">Period:</span> {formatDate(intern.start_date)} - {formatDate(intern.end_date)}</div>
                      {intern.mentor_profile && (
                        <div><span className="text-muted-foreground">Mentor:</span> {intern.mentor_profile.full_name}</div>
                      )}
                    </div>

                    {primaryRole !== "employee" && (
                      <div className="pt-3 border-t border-border">
                        <div className="text-sm font-medium mb-2">Performance rating</div>
                        <div className="flex gap-2">
                          <Select value={intern.performance_rating?.toString() || "3"} onValueChange={setRatingValue}>
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 ⭐</SelectItem>
                              <SelectItem value="2">2 ⭐</SelectItem>
                              <SelectItem value="3">3 ⭐</SelectItem>
                              <SelectItem value="4">4 ⭐</SelectItem>
                              <SelectItem value="5">5 ⭐</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => updateRating(intern.id)}
                            disabled={ratingId === intern.id}
                          >
                            {ratingId === intern.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            <Star className="mr-1 h-4 w-4" />
                            Rate
                          </Button>
                        </div>
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
