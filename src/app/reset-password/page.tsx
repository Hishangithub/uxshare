"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMsg("❌ " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Password updated. Redirecting to login…");

    await supabase.auth.signOut();

    setTimeout(() => {
      router.push("/login");
    }, 1200);

    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto glass-card glass p-5 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-sm text-neutral-400">
          Enter your new password below.
        </p>
      </div>

      {msg && <p className="text-sm glass-card glass px-3 py-2">{msg}</p>}

      <form onSubmit={updatePassword} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">New password</label>
          <input
            className="input"
            type="password"
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Confirm new password
          </label>
          <input
            className="input"
            type="password"
            value={confirm}
            minLength={6}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <button className="btn w-full" disabled={loading} type="submit">
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}