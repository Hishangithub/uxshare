"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLink() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) { if (active) setIsAdmin(false); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (!active) return;
      setIsAdmin((data?.role ?? "").toUpperCase() === "ADMIN");
    })();
    return () => { active = false; };
  }, []);

  if (!isAdmin) return null;
  return <Link href="/admin/moderation" className="hover:underline">Admin</Link>;
}
