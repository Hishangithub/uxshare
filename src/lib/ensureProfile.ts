import { SupabaseClient } from "@supabase/supabase-js";

export default async function ensureProfile(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;
  if (!uid) return { ok: false, reason: "no-user" };

  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", uid)
    .maybeSingle();

  if (selErr) return { ok: false, reason: selErr.message };
  if (existing) return { ok: true };

  const fullName = auth.user?.user_metadata?.full_name ?? auth.user?.email ?? "User";

  const { error: insErr } = await supabase.from("profiles").insert([
    {
      id: uid,
      full_name: fullName,
      role: "DESIGNER",
      reputation: 0,
    },
  ]);

  if (insErr) return { ok: false, reason: insErr.message };
  return { ok: true };
}
