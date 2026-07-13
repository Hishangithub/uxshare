"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function MyProfileRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    async function goToMyProfile() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      router.replace(`/profile/${user.id}`);
    }

    void goToMyProfile();
  }, [router]);

  return <p>Loading profile…</p>;
}