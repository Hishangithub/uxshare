"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ModerateLink() {
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkRole() {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;

      if (!uid) {
        if (active) setIsModerator(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();

      if (active) {
        setIsModerator((data?.role ?? "").toUpperCase() === "MODERATOR");
      }
    }

    void checkRole();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void checkRole();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!isModerator) return null;

  return (
    <Link href="/moderate" className="nav-link">
      Moderate
    </Link>
  );
}