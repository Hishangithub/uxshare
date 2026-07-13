"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMsg(null);

    const redirectTo = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    if (error) {
      setMsg("❌ " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Password reset email sent. Check your inbox.");
    setLoading(false);
  }

  return (
    <div className="max-w-md mx-auto glass-card glass p-5 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Forgot password</h1>
        <p className="text-sm text-neutral-400">
          Enter your email and we will send you a reset link.
        </p>
      </div>

      {msg && <p className="text-sm glass-card glass px-3 py-2">{msg}</p>}

      <form onSubmit={sendReset} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button className="btn w-full" disabled={loading} type="submit">
          {loading ? "Sending…" : "Send reset email"}
        </button>
      </form>

      <p className="text-sm text-neutral-400">
        Remembered it?{" "}
        <Link href="/login" className="underline text-neutral-200">
          Back to log in
        </Link>
      </p>
    </div>
  );
}