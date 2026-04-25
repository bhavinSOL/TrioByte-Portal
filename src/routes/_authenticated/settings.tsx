import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme, type Theme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Sun, Moon, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const pwSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — TrioByte Portal" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = pwSchema.safeParse({ password, confirm });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPassword(""); setConfirm("");
  };

  const themes: { id: Theme; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { id: "light", label: "Light", icon: Sun, desc: "Clean and bright" },
    { id: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
    { id: "accent", label: "TrioByte Accent", icon: Sparkles, desc: "Branded teal accent" },
  ];

  return (
    <>
      <PageHeader title="Settings" description="Manage your appearance, security and account." />
      <PageBody>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how the portal looks for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={cn(
                      "relative text-left rounded-lg border p-4 transition-all hover:border-primary",
                      active ? "border-primary ring-2 ring-primary/30" : "border-border"
                    )}
                  >
                    <Icon className="h-5 w-5 mb-2 text-primary" />
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                    {active && (
                      <span className="absolute top-3 right-3 text-primary"><Check className="h-4 w-4" /></span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onChangePassword} className="space-y-4 max-w-sm">
              <div className="space-y-2">
                <Label htmlFor="np">New password</Label>
                <Input id="np" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp">Confirm password</Label>
                <Input id="cp" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign out</CardTitle>
            <CardDescription>End your session on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
