"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      setCheckingSession(true);

      const urlError = searchParams.get("error_description");

      if (urlError) {
        setErrorMessage(urlError);
        setCheckingSession(false);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setHasSession(true);
      } else {
        setHasSession(false);
      }

      setCheckingSession(false);
    }

    void checkSession();
  }, [searchParams]);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    setMessage(null);
    setErrorMessage(null);

    if (!password.trim()) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("Your password has been updated. You can now log in.");
    setLoading(false);
  }

  if (checkingSession) {
    return (
      <div className="mx-auto max-w-md">
        <div className="glass-card glass p-6">
          <p className="text-sm text-neutral-300">Checking reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <p className="chip w-fit">Account recovery</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Reset password
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Enter a new password for your UXShare account.
        </p>
      </div>

      <div className="glass-card glass p-5 space-y-4">
        {message && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {!hasSession && !message ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-300">
              This reset link is missing, expired, or invalid. Please request a
              new password reset link.
            </p>

            <Link href="/forgot-password" className="btn">
              Request new reset link
            </Link>
          </div>
        ) : message ? (
          <Link href="/login" className="btn gradient-fill-btn">
            Go to login
          </Link>
        ) : (
          <form onSubmit={handleReset} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                New password
              </label>

              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Confirm password
              </label>

              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <button
              className="btn gradient-fill-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md">
          <div className="glass-card glass p-6">
            <p className="text-sm text-neutral-300">Loading reset page…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}