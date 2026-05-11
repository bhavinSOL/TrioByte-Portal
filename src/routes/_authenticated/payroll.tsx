import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth } from "../../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "../../integrations/supabase/client";
import { useState, useEffect } from "react";
import { Loader2, Plus, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Salary & Overtime — TrioByte Portal" }] }),
  component: PayrollPage,
});

interface PayrollRecord {
  id: string;
  user_id: string;
  month: string;
  base_salary: number | null;
  overtime_hours: number;
  overtime_rate: number;
  bonus: number;
  deductions: number;
  total_salary: number;
  status: string;
  paid_date: string | null;
  profiles?: { full_name: string | null };
}

interface Employee {
  id: string;
  full_name: string | null;
}

function PayrollPage() {
  const { profile, primaryRole } = useAuth();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    month: "",
    base_salary: "",
    overtime_hours: "",
    bonus: "",
    deductions: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  useEffect(() => {
    loadPayroll();
    if (primaryRole !== "employee") {
      loadEmployees();
    }
  }, [profile?.id, primaryRole]);

  const loadPayroll = async () => {
    try {
      if (primaryRole === "employee") {
        const { data } = await (supabase as any)
          .from("payroll")
          .select("*")
          .eq("user_id", profile?.id)
          .order("month", { ascending: false });
        setRecords(data || []);
      } else {
        const { data } = await (supabase as any)
          .from("payroll")
          .select("*, profiles(full_name)")
          .order("month", { ascending: false });
        setRecords(data || []);
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
        .order("full_name");
      setEmployees(data || []);
    } catch (error) {
      // Ignore
    }
  };

  const calculateTotal = () => {
    const base = parseFloat(form.base_salary) || 0;
    const overtime = (parseFloat(form.overtime_hours) || 0) * (50 / 8) * (parseFloat(form.base_salary) || 0) / 20; // Rough calculation
    const bonus = parseFloat(form.bonus) || 0;
    const deductions = parseFloat(form.deductions) || 0;
    return base + overtime + bonus - deductions;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id || !form.month || !form.base_salary) {
      return toast.error("Fill all required fields");
    }

    try {
      setSubmitting(true);
      const overtimeHours = parseFloat(form.overtime_hours) || 0;
      const hourlyRate = (parseFloat(form.base_salary) || 0) / 160; // 160 working hours per month
      const overtimePay = overtimeHours * hourlyRate * 1.5;

      const { error } = await (supabase as any)
        .from("payroll")
        .insert({
          user_id: form.user_id,
          month: form.month,
          base_salary: parseFloat(form.base_salary),
          overtime_hours: overtimeHours,
          bonus: parseFloat(form.bonus) || 0,
          deductions: parseFloat(form.deductions) || 0,
          total_salary:
            parseFloat(form.base_salary) +
            overtimePay +
            (parseFloat(form.bonus) || 0) -
            (parseFloat(form.deductions) || 0),
          created_by: profile?.id,
        });

      if (error) throw error;
      toast.success("Payroll record created");
      setForm({ user_id: "", month: "", base_salary: "", overtime_hours: "", bonus: "", deductions: "" });
      setIsDialogOpen(false);
      await loadPayroll();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      setMarkingPaid(id);
      const { error } = await (supabase as any)
        .from("payroll")
        .update({
          status: "paid",
          paid_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Marked as paid");
      await loadPayroll();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setMarkingPaid(null);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date + "-01T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (isLoading) {
    return (
      <>
        <PageHeader title="Salary & overtime" description="Manage payroll and overtime." />
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
        title="Salary & overtime"
        description={primaryRole === "employee" ? "View your salary records." : "Manage employee payroll and overtime."}
        actions={
          primaryRole !== "employee" && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Create payroll</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create payroll record</DialogTitle>
                  <DialogDescription>Enter monthly salary and overtime data.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="emp">Employee</Label>
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
                  <div>
                    <Label htmlFor="month">Month</Label>
                    <Input
                      id="month"
                      type="month"
                      value={form.month}
                      onChange={(e) => setForm(prev => ({ ...prev, month: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="salary">Base salary</Label>
                      <Input
                        id="salary"
                        type="number"
                        value={form.base_salary}
                        onChange={(e) => setForm(prev => ({ ...prev, base_salary: e.target.value }))}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="overtime">Overtime hours</Label>
                      <Input
                        id="overtime"
                        type="number"
                        value={form.overtime_hours}
                        onChange={(e) => setForm(prev => ({ ...prev, overtime_hours: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bonus">Bonus</Label>
                      <Input
                        id="bonus"
                        type="number"
                        value={form.bonus}
                        onChange={(e) => setForm(prev => ({ ...prev, bonus: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deductions">Deductions</Label>
                      <Input
                        id="deductions"
                        type="number"
                        value={form.deductions}
                        onChange={(e) => setForm(prev => ({ ...prev, deductions: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create record
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <PageBody>
        {records.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground py-12">
              No payroll records
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {records.map((record) => (
              <Card key={record.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      {primaryRole !== "employee" && (
                        <div className="text-sm text-muted-foreground mb-1">{record.profiles?.full_name || "—"}</div>
                      )}
                      <div className="text-lg font-semibold">{formatDate(record.month)}</div>
                    </div>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      record.status === "paid" ? "bg-green-100 text-green-800" :
                      record.status === "finalized" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {record.status}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Base salary</div>
                      <div className="text-lg font-semibold">{formatCurrency(record.base_salary)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Overtime ({record.overtime_hours}h)</div>
                      <div className="text-lg font-semibold">{formatCurrency((record.overtime_hours * (record.base_salary || 0) / 160 * record.overtime_rate))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Bonus</div>
                      <div className="text-lg font-semibold text-green-600">{formatCurrency(record.bonus)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Deductions</div>
                      <div className="text-lg font-semibold text-red-600">-{formatCurrency(record.deductions)}</div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Total salary</div>
                      <div className="text-2xl font-bold text-primary">{formatCurrency(record.total_salary)}</div>
                    </div>
                  </div>

                  {record.paid_date && (
                    <div className="text-xs text-muted-foreground mb-3">
                      Paid on: {new Date(record.paid_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  )}

                  {primaryRole !== "employee" && record.status !== "paid" && (
                    <Button
                      size="sm"
                      onClick={() => markAsPaid(record.id)}
                      disabled={markingPaid === record.id}
                      className="w-full"
                    >
                      {markingPaid === record.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      <DollarSign className="mr-2 h-4 w-4" />
                      Mark as paid
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
