// One-time bootstrap to create the initial founder account.
// Public (no JWT) but guarded: only succeeds if no founder exists yet.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, srk, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || "TrioByte Founder");

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: refuse if a founder already exists
    const { data: existingFounders, error: fErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "founder")
      .limit(1);
    if (fErr) throw fErr;
    if (existingFounders && existingFounders.length > 0) {
      return new Response(JSON.stringify({ error: "Founder already exists. Bootstrap disabled." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to create; if user already exists, update password
    let userId: string | null = null;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "founder", must_change_password: false },
    });

    if (cErr) {
      // Find existing
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email?.toLowerCase() === email);
      if (!existing) throw cErr;
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user.id;
    }

    // Ensure profile + founder role
    await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      must_change_password: false,
      level: 5,
    });
    await admin.from("user_roles").delete().eq("user_id", userId);
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "founder" });
    if (rErr) throw rErr;

    return new Response(JSON.stringify({ ok: true, user_id: userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
