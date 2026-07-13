"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /*
    This clears the form state when the sign up page loads.
    The autocomplete settings on the inputs also help stop the browser from
    filling old login/admin credentials into the sign up form.
  */
  useEffect(() => {
    setFullName("");
    setUsername("");
    setEmail("");
    setPassword("");
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);

    if (!email.trim() || !password.trim()) {
      setMsg("Please enter your email and password.");
      return;
    }

    if (password.length < 6) {
      setMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setMsg("❌ " + error.message);
      setLoading(false);
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      const { error: profileError } = await supabase.from("profiles").upsert([
        {
          id: userId,
          full_name: fullName.trim() || email.trim(),
          username: username.trim() || null,
          role: "USER",
        },
      ]);

      if (profileError) {
        setMsg("Account created, but profile setup failed: " + profileError.message);
        setLoading(false);
        return;
      }
    }

    setMsg("✅ Account created. You can now start using UXShare.");
    setLoading(false);

    router.push("/designs");
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
      <section className="space-y-7">
        <p className="chip w-fit">Join UXShare</p>

        <div className="space-y-5">
          <h1 className="hero-title text-5xl sm:text-6xl font-semibold">
            Share designs. Get better feedback.
          </h1>

          <p className="hero-subtitle max-w-xl text-base sm:text-lg">
            Create an account to upload product and web designs, receive
            structured feedback, and take part in a constructive design
            community.
          </p>
        </div>

        <div className="glass-card glass p-6">
          <p className="text-sm font-semibold text-neutral-100">
            What you can do with an account
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold">Upload designs</p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Share images or Figma previews with the community.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold">Give feedback</p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Rate usability, visual design, and clarity.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold">Build a profile</p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Show your username, avatar, and design activity.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-semibold">Stay constructive</p>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Basic NLP moderation helps reduce harmful feedback.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card glass p-6 sm:p-8">
        <div className="mb-7 space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">
            Create account
          </h2>

          <p className="text-sm leading-6 text-neutral-400">
            Set up your UXShare account and start sharing feedback.
          </p>
        </div>

        {msg && (
          <p className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-neutral-200">
            {msg}
          </p>
        )}

        <form
          onSubmit={handleSignup}
          className="space-y-5"
          autoComplete="off"
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium">Full name</label>

            <input
              className="input"
              type="text"
              name="uxshare-signup-name-empty"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Username</label>

            <input
              className="input"
              type="text"
              name="uxshare-signup-username-empty"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Example: clairdesigns"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Email</label>

            <input
              className="input"
              type="email"
              name="uxshare-signup-email-empty"
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
              name="uxshare-signup-password-empty"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-7 border-t border-white/10 pt-5">
          <p className="text-sm text-neutral-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-neutral-100 hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}