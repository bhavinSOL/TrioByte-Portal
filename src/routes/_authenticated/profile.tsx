import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/portal/page-header";
import { useAuth, roleLabel } from "../../lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { levelRing } from "@/components/portal/portal-sidebar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — TrioByte Portal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, primaryRole, refresh } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    mobile: profile?.mobile ?? "",
    address: profile?.address ?? "",
    photo_url: profile?.photo_url ?? "",
    employee_id: profile?.employee_id ?? "",
    company_id: profile?.company_id ?? "",
    level: profile?.level ?? 1,
    joining_date: profile?.joining_date ?? "",
    end_date: profile?.end_date ?? "",
    is_permanent: profile?.is_permanent ?? false,
  });

  const isStaff = primaryRole === "hr_admin" || primaryRole === "founder";
  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSaving(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile?.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
      setForm(prev => ({ ...prev, photo_url: data.publicUrl }));
      toast.success("Photo uploaded");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updates: Record<string, any> = {
        full_name: form.full_name,
        mobile: form.mobile,
        address: form.address,
        photo_url: form.photo_url,
      };

      if (isStaff) {
        updates.employee_id = form.employee_id;
        updates.company_id = form.company_id;
        updates.level = form.level;
        updates.joining_date = form.joining_date || null;
        updates.end_date = form.end_date || null;
        updates.is_permanent = form.is_permanent;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile?.id);

      if (error) throw error;

      await refresh();
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your personal and employment information."
        actions={
          !isEditing && (
            <Button onClick={() => setIsEditing(true)} size="sm">
              Edit profile
            </Button>
          )
        }
      />
      <PageBody>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                {profile?.photo_url ? (
                  <img
                    src={form.photo_url}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-secondary"
                  />
                ) : (
                  <div className={cn("h-20 w-20 rounded-full grid place-items-center text-xl font-semibold ring-4 bg-secondary text-secondary-foreground", levelRing(profile?.level ?? 1))}>
                    {initials}
                  </div>
                )}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-2 rounded-full cursor-pointer hover:bg-primary/90">
                    <Upload className="h-3 w-3" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={isSaving}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{profile?.full_name ?? "—"}</div>
                <div className="text-sm text-muted-foreground truncate">{profile?.email ?? "—"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{roleLabel(primaryRole)}</Badge>
                  <Badge variant="outline">Level {profile?.level ?? 1}</Badge>
                  {profile?.is_permanent && <Badge>Permanent</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isEditing ? (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={form.mobile}
                    onChange={(e) => setForm(prev => ({ ...prev, mobile: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {isStaff && (
              <Card>
                <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="employee_id">Employee ID</Label>
                      <Input
                        id="employee_id"
                        value={form.employee_id}
                        onChange={(e) => setForm(prev => ({ ...prev, employee_id: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company_id">Company ID</Label>
                      <Input
                        id="company_id"
                        value={form.company_id}
                        onChange={(e) => setForm(prev => ({ ...prev, company_id: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="level">Level</Label>
                      <Input
                        id="level"
                        type="number"
                        value={form.level}
                        onChange={(e) => setForm(prev => ({ ...prev, level: parseInt(e.target.value) || 1 }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="joining_date">Joining date</Label>
                      <Input
                        id="joining_date"
                        type="date"
                        value={form.joining_date}
                        onChange={(e) => setForm(prev => ({ ...prev, joining_date: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_date">End date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                        disabled={form.is_permanent}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_permanent}
                          onChange={(e) => setForm(prev => ({ ...prev, is_permanent: e.target.checked, end_date: "" }))}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">Permanent</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setForm({
                    full_name: profile?.full_name ?? "",
                    mobile: profile?.mobile ?? "",
                    address: profile?.address ?? "",
                    photo_url: profile?.photo_url ?? "",
                    employee_id: profile?.employee_id ?? "",
                    company_id: profile?.company_id ?? "",
                    level: profile?.level ?? 1,
                    joining_date: profile?.joining_date ?? "",
                    end_date: profile?.end_date ?? "",
                    is_permanent: profile?.is_permanent ?? false,
                  });
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Full name" value={profile?.full_name} />
                <Field label="Mobile" value={profile?.mobile} />
                <Field label="Address" value={profile?.address} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Employment</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Field label="Employee ID" value={profile?.employee_id} />
                <Field label="Company ID" value={profile?.company_id} />
                <Field label="Joining date" value={profile?.joining_date} />
                <Field label="End date" value={profile?.is_permanent ? "Permanent" : profile?.end_date} />
              </CardContent>
            </Card>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value || "—"}</span>
    </div>
  );
}
