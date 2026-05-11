import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { autoLoginUser, checkAndAutoLogout } from "@/lib/attendance-service";

export type AppRole = "employee" | "hr_admin" | "founder";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  employee_id: string | null;
  company_id: string | null;
  address: string | null;
  mobile: string | null;
  photo_url: string | null;
  level: number;
  joining_date: string | null;
  end_date: string | null;
  is_permanent: boolean;
  must_change_password: boolean;
  is_blocked: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      (supabase as any).from("profiles").select("*").eq("id", userId).maybeSingle(),
      (supabase as any).from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(profileData ?? null);
    setRoles((roleData ?? []).map((r: { role: AppRole }) => r.role));

    // Auto-login on first app access
    if (profileData && (roleData ?? []).some((r: any) => r.role === "employee")) {
      await autoLoginUser(userId);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        loadProfile(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  // Setup auto-logout check interval (every minute)
  useEffect(() => {
    if (!session?.user?.id) return;

    const interval = setInterval(async () => {
      await checkAndAutoLogout(session.user.id);
    }, 60000); // Check every minute

    // Also check immediately on mount
    checkAndAutoLogout(session.user.id);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const signOut = async () => {
    // Log logout attendance before signing out
    if (session?.user?.id) {
      try {
        const today = new Date().toISOString().split('T')[0]; // Get date in YYYY-MM-DD format
        await (supabase as any)
          .from("attendance")
          .update({ logout_time: new Date().toISOString() })
          .eq("user_id", session.user.id)
          .eq("date", today);
      } catch (error) {
        console.error("Failed to log logout attendance:", error);
      }
    }
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const primaryRole: AppRole | null = useMemo(() => {
    if (roles.includes("founder")) return "founder";
    if (roles.includes("hr_admin")) return "hr_admin";
    if (roles.includes("employee")) return "employee";
    return null;
  }, [roles]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        roles,
        primaryRole,
        loading,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function roleLabel(role: AppRole | null): string {
  switch (role) {
    case "founder":
      return "Founder / CEO";
    case "hr_admin":
      return "HR / Admin";
    case "employee":
      return "Employee";
    default:
      return "—";
  }
}
