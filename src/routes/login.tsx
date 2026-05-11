import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TrioByteMark } from "@/components/brand/triobyte-mark";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(128),
});

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TrioByte Portal" },
      { name: "description", content: "Sign in to your TrioByte company account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      if (profile.must_change_password) navigate({ to: "/change-password" });
      else navigate({ to: "/dashboard" });
    }
  }, [loading, session, profile, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error, data } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    // Log login attendance
    if (data.user?.id) {
      try {
        const today = new Date().toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
        await (supabase as any)
          .from("attendance")
          .upsert({
            user_id: data.user.id,
            date: today,
            login_time: new Date().toISOString(),
            status: "present",
          }, {
            onConflict: "user_id,date"
          });
      } catch (error: any) {
        console.error("Failed to log login attendance:", error);
      }
    }

    toast.success("Welcome back");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 text-sidebar-foreground" style={{ background: "var(--gradient-brand)" }}>
        <div className="flex items-center gap-3">
          <TrioByteMark className="h-9 w-9" />
          <div>
            <div className="text-lg font-semibold tracking-tight">TrioByte Technology</div>
            <div className="text-xs opacity-80">Internal Company Portal</div>
          </div>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Engineered for the people who run the company.</h1>
          <p className="text-sm opacity-90">
            Securely manage projects, code, attendance and your team — all in one place.
          </p>
        </div>
        <div className="text-xs opacity-70">© {new Date().getFullYear()} TrioByte Technology. All rights reserved.</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60" style={{ boxShadow: "var(--shadow-elegant)" }}>
          <CardHeader className="space-y-1">
            <div className="lg:hidden flex items-center gap-2 mb-2">
              <TrioByteMark className="h-7 w-7" />
              <span className="font-semibold">TrioByte</span>
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Use your company email to access the portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Company email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@triobyte.tech"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Accounts are created by HR or Admin. Contact your administrator if you need access.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
