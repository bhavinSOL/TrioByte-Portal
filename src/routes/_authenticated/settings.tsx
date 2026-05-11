import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTheme, type Theme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../../lib/auth";
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
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preferences, setPreferences] = useState({
    timezone: "UTC",
    work_start_time: "09:00",
    work_end_time: "18:00",
    notifications_enabled: true,
    email_notifications: true,
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, [profile?.id]);

  const loadPreferences = async () => {
    try {
      const { data } = await (supabase as any)
        .from("user_preferences")
        .select("*")
        .eq("user_id", profile?.id)
        .maybeSingle();

      if (data) {
        setPreferences({
          timezone: data.timezone || "UTC",
          work_start_time: data.work_start_time || "09:00",
          work_end_time: data.work_end_time || "18:00",
          notifications_enabled: data.notifications_enabled !== false,
          email_notifications: data.email_notifications !== false,
        });
      }
    } catch (error) {
      // Ignore if table doesn't exist yet
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  const savePreferences = async () => {
    try {
      setIsSavingPrefs(true);

      const { data: existing } = await (supabase as any)
        .from("user_preferences")
        .select("id")
        .eq("user_id", profile?.id)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("user_preferences")
          .update(preferences)
          .eq("user_id", profile?.id);
      } else {
        await (supabase as any)
          .from("user_preferences")
          .insert({
            user_id: profile?.id,
            ...preferences,
          });
      }

      toast.success("Preferences saved");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSavingPrefs(false);
    }
  };

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
            <CardTitle>Work Preferences</CardTitle>
            <CardDescription>Set your work hours, timezone, and notification settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="start_time">Start time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={preferences.work_start_time}
                  onChange={(e) => setPreferences(prev => ({ ...prev, work_start_time: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end_time">End time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={preferences.work_end_time}
                  onChange={(e) => setPreferences(prev => ({ ...prev, work_end_time: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={preferences.timezone} onValueChange={(value) => setPreferences(prev => ({ ...prev, timezone: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="EST">EST (Eastern)</SelectItem>
                  <SelectItem value="CST">CST (Central)</SelectItem>
                  <SelectItem value="MST">MST (Mountain)</SelectItem>
                  <SelectItem value="PST">PST (Pacific)</SelectItem>
                  <SelectItem value="IST">IST (India)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="text-sm font-medium">Notifications</div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.notifications_enabled}
                  onChange={(e) => setPreferences(prev => ({ ...prev, notifications_enabled: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">In-app notifications</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.email_notifications}
                  onChange={(e) => setPreferences(prev => ({ ...prev, email_notifications: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Email notifications</span>
              </label>
            </div>
            <Button onClick={savePreferences} disabled={isSavingPrefs} variant="secondary">
              {isSavingPrefs && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save preferences
            </Button>
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
