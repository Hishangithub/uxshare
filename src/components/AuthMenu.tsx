"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  username: string | null;
  full_name: string | null;
  role: string | null;
};

export default function AuthMenu() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user ?? null;

    if (!user) {
      setEmail(null);
      setProfile(null);
      return;
    }

    setEmail(user.email ?? null);

    const { data } = await supabase
      .from("profiles")
      .select("username,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    setProfile((data as Profile) ?? null);
  }

  useEffect(() => {
    void load();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const label = useMemo(() => {
    if (profile?.username) return `@${profile.username}`;
    if (profile?.full_name) return profile.full_name;
    return email ?? "Account";
  }, [profile, email]);

  async function signOut() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/designs");
    router.refresh();
  }

  if (!email) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="nav-link">
          Log in
        </Link>

        <Link href="/signup" className="btn">
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="nav-link" onClick={() => setOpen((v) => !v)}>
        {label}
      </button>

      {open && (
        <div className="menu-panel absolute right-0 mt-3 w-44 rounded-2xl p-2 z-50">
          <Link
            href="/profile"
            className="menu-item"
            onClick={() => setOpen(false)}
          >
            My Profile
          </Link>

          <button className="menu-item" onClick={() => void signOut()}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}