import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const Route = createFileRoute("/change-password")({
  head: () => ({ meta: [{ title: "Change password — TrioByte Portal" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const { session, profile, loading, refresh, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    if (session?.user) {
      await (supabase as any).from("profiles").update({ must_change_password: false }).eq("id", session.user.id);
    }
    await refresh();
    setSubmitting(false);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <CardHeader>
          <div className="inline-flex items-center gap-2 text-warning">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Required</span>
          </div>
          <CardTitle>Change your password</CardTitle>
          <CardDescription>
            For security, you must replace the default password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password and continue
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut().then(() => navigate({ to: "/login" }))}>
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
