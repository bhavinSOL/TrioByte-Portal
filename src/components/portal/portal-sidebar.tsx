import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  User,
  GitBranch,
  MessagesSquare,
  Settings,
  Users,
  CalendarCheck,
  ClipboardList,
  ShieldCheck,
  GraduationCap,
  Wallet,
  ListChecks,
  Crown,
  LogOut,
} from "lucide-react";
import { useAuth, type AppRole, roleLabel } from "@/lib/auth";
import { TrioByteMark } from "@/components/brand/triobyte-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, roles: ["employee", "hr_admin", "founder"] },
  { label: "My Profile", to: "/profile", icon: User, roles: ["employee", "hr_admin", "founder"] },
  { label: "Code Repos", to: "/code", icon: GitBranch, roles: ["employee", "hr_admin", "founder"] },
  { label: "Chat", to: "/chat", icon: MessagesSquare, roles: ["employee", "hr_admin", "founder"] },
  // HR / Admin
  { label: "Team Directory", to: "/team", icon: Users, roles: ["hr_admin", "founder"] },
  { label: "Attendance", to: "/attendance", icon: CalendarCheck, roles: ["hr_admin", "founder"] },
  { label: "Leave Requests", to: "/leave", icon: ClipboardList, roles: ["hr_admin", "founder"] },
  { label: "Tasks & Deadlines", to: "/tasks", icon: ListChecks, roles: ["hr_admin", "founder"] },
  { label: "Interns", to: "/interns", icon: GraduationCap, roles: ["hr_admin", "founder"] },
  { label: "Salary & Overtime", to: "/payroll", icon: Wallet, roles: ["hr_admin", "founder"] },
  { label: "Roles & Access", to: "/roles", icon: ShieldCheck, roles: ["hr_admin", "founder"] },
  // Founder only
  { label: "Executive Overview", to: "/executive", icon: Crown, roles: ["founder"] },
  // Common bottom
  { label: "Settings", to: "/settings", icon: Settings, roles: ["employee", "hr_admin", "founder"] },
];

export function PortalSidebar() {
  const { primaryRole, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items = NAV.filter((n) => primaryRole && n.roles.includes(primaryRole));

  const initials =
    (profile?.full_name ?? profile?.email ?? "?")
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <TrioByteMark className="h-8 w-8 text-sidebar-primary" />
        <div>
          <div className="text-sm font-semibold tracking-tight">TrioByte</div>
          <div className="text-[10px] uppercase tracking-wider opacity-70">Internal Portal</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div
            className={cn(
              "h-9 w-9 rounded-full grid place-items-center text-xs font-semibold ring-2",
              levelRing(profile?.level ?? 1)
            )}
            style={{ background: "var(--sidebar-accent)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{profile?.full_name ?? "—"}</div>
            <div className="text-[11px] opacity-70 truncate">{roleLabel(primaryRole)}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function levelRing(level: number): string {
  // Google-style level color ring: bronze, silver, gold, platinum, diamond
  if (level >= 5) return "ring-cyan-400";
  if (level >= 4) return "ring-violet-400";
  if (level >= 3) return "ring-yellow-400";
  if (level >= 2) return "ring-zinc-300";
  return "ring-amber-600";
}
