import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth, type AppRole, roleLabel } from "../../lib/auth";
import { supabase } from "../../integrations/supabase/client";
import { PageBody, PageHeader, Placeholder } from "@/components/portal/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Users } from "lucide-react";

interface Row {
  id: string;
  full_name: string | null;
  email: string | null;
  employee_id: string | null;
  level: number;
  is_blocked: boolean;
  is_permanent: boolean;
  role: AppRole | null;
}

const inviteSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  employee_id: z.string().trim().max(50).optional(),
  role: z.enum(["employee", "hr_admin", "founder"]),
  password: z.string().min(8, "Use at least 8 characters").max(128),
});

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team Directory — TrioByte Portal" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { primaryRole } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (primaryRole && !["hr_admin", "founder"].includes(primaryRole)) {
      navigate({ to: "/dashboard" });
    }
  }, [primaryRole, navigate]);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, employee_id, level, is_blocked, is_permanent")
      .order("created_at", { ascending: false });
    const { data: rolesData } = await (supabase as any).from("user_roles").select("user_id, role");
    const roleMap = new Map<string, AppRole>();
    (rolesData ?? []).forEach((r: { user_id: string; role: AppRole }) => {
      // founder > hr_admin > employee priority
      const existing = roleMap.get(r.user_id);
      const rank = (x: AppRole) => (x === "founder" ? 3 : x === "hr_admin" ? 2 : 1);
      if (!existing || rank(r.role) > rank(existing)) roleMap.set(r.user_id, r.role);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? null })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Team directory"
        description="Manage employee accounts, roles and access."
        actions={<InviteDialog onCreated={load} />}
      />
      <PageBody>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>{rows.length} people in your organization</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-10 grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : rows.length === 0 ? (
              <div className="p-6"><Placeholder icon={<Users className="h-5 w-5" />} title="No employees yet" description="Use the 'New employee' button to onboard your first team member." /></div>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="px-6 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.employee_id && <Badge variant="outline">{r.employee_id}</Badge>}
                      <Badge variant="secondary">{roleLabel(r.role)}</Badge>
                      <Badge variant="outline">L{r.level}</Badge>
                      {r.is_blocked && <Badge variant="destructive">Blocked</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function InviteDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    employee_id: "",
    role: "employee" as AppRole,
    password: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = inviteSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);

    // Sign up via public auth API. Trigger creates profile + default role from metadata.
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.full_name,
          role: parsed.data.role,
          must_change_password: true,
        },
      },
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }

    // Update employee_id if provided (profile was just created by trigger)
    if (parsed.data.employee_id) {
      // We don't know the new user id from signUp result without confirmation; query by email
      const { data: prof } = await (supabase as any)
        .from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
      if (prof?.id) {
        await (supabase as any).from("profiles").update({ employee_id: parsed.data.employee_id }).eq("id", prof.id);
      }
    }

    setSubmitting(false);
    setOpen(false);
    setForm({ full_name: "", email: "", employee_id: "", role: "employee", password: "" });
    toast.success("Employee account created. Share the temporary password securely.");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />New employee</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Onboard a new employee</DialogTitle>
          <DialogDescription>
            Set a temporary password — the employee will be required to change it on first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn">Full name</Label>
              <Input id="fn" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eid">Employee ID</Label>
              <Input id="eid" placeholder="TB-00123" value={form.employee_id} onChange={(e) => set("employee_id", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="em">Company email</Label>
            <Input id="em" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="hr_admin">HR / Admin</SelectItem>
                  <SelectItem value="founder">Founder / CEO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Temporary password</Label>
              <Input id="pw" type="text" value={form.password} onChange={(e) => set("password", e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
