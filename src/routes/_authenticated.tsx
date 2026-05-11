import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { Loader2, Ban } from "lucide-react";
import { useTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Activate persisted theme on every authenticated page render
  useTheme();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login" });
    else if (profile?.must_change_password) navigate({ to: "/change-password" });
  }, [loading, session, profile, navigate]); 

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profile?.is_blocked) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center text-destructive">
            <Ban className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">Account suspended</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been blocked. Please contact HR or the Founder for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <PortalSidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
