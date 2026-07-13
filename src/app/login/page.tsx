"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /*
    This clears React state when the login page loads.
    Browser/password-manager autofill can still visually appear sometimes,
    so the input fields below also use autocomplete settings that discourage it.
  */
  useEffect(() => {
    setEmail("");
    setPassword("");
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setMsg("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg("❌ " + error.message);
      setLoading(false);
      return;
    }

    setMsg("✅ Logged in successfully.");
    router.push("/designs");
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
      <section className="space-y-7">
        <p className="chip w-fit">Welcome back</p>

        <div className="space-y-5">
          <h1 className="hero-title text-5xl sm:text-6xl font-semibold">
            Continue creating better feedback.
          </h1>

          <p className="hero-subtitle max-w-xl text-base sm:text-lg">
            Log in to upload designs, give structured feedback, upvote useful
            comments, and manage your UXShare profile.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-card glass p-5">
            <p className="text-2xl font-semibold">01</p>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Upload and preview your UI work.
            </p>
          </div>

          <div className="glass-card glass p-5">
            <p className="text-2xl font-semibold">02</p>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Receive structured design feedback.
            </p>
          </div>

          <div className="glass-card glass p-5">
            <p className="text-2xl font-semibold">03</p>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Keep discussions constructive with moderation.
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card glass p-6 sm:p-8">
        <div className="mb-7 space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">Log in</h2>
          <p className="text-sm leading-6 text-neutral-400">
            Enter your account details to continue to UXShare.
          </p>
        </div>

        {msg && (
          <p className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-neutral-200">
            {msg}
          </p>
        )}

        <form
          onSubmit={handleLogin}
          className="space-y-5"
          autoComplete="off"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium">Email</label>

            <input
              className="input"
              type="email"
              name="uxshare-login-email-empty"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Password</label>

            <input
              className="input"
              type="password"
              name="uxshare-login-password-empty"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <button
            className="btn gradient-fill-btn w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/forgot-password" className="hover:underline">
            Forgot password?
          </Link>

          <p>
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-neutral-100 hover:underline"
            >
              Create account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}