'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin'|'signup'|'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/designs');
    });
  }, [router]);

  async function doSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg('❌ ' + error.message);
    else router.replace('/designs');
    setBusy(false);
  }

  async function doSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg('❌ ' + error.message);
    else setMsg('✅ Check your email to confirm your account.');
    setBusy(false);
  }

  async function doForgot(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    const redirectTo = `${window.location.origin}/auth/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) setMsg('❌ ' + error.message);
    else setMsg('✅ Password reset email sent.');
    setBusy(false);
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Account</h1>
      {msg && <p className="glass-card glass px-3 py-2 text-sm">{msg}</p>}

      <div className="flex gap-2">
        <button className={`btn ${mode==='signin'?'bg-neutral-800':''}`} onClick={()=>setMode('signin')}>Sign in</button>
        <button className={`btn ${mode==='signup'?'bg-neutral-800':''}`} onClick={()=>setMode('signup')}>Sign up</button>
        <button className={`btn ${mode==='forgot'?'bg-neutral-800':''}`} onClick={()=>setMode('forgot')}>Forgot</button>
      </div>

      {mode==='signin' && (
        <form onSubmit={doSignIn} className="glass-card glass p-4 space-y-3">
          <label className="block text-sm">
            <span className="block mb-1">Email</span>
            <input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="block mb-1">Password</span>
            <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          <button className="btn" disabled={busy} type="submit">{busy?'Signing in…':'Sign in'}</button>
        </form>
      )}

      {mode==='signup' && (
        <form onSubmit={doSignUp} className="glass-card glass p-4 space-y-3">
          <label className="block text-sm">
            <span className="block mb-1">Email</span>
            <input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm">
            <span className="block mb-1">Password</span>
            <input type="password" className="input" value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          <button className="btn" disabled={busy} type="submit">{busy?'Creating…':'Create account'}</button>
        </form>
      )}

      {mode==='forgot' && (
        <form onSubmit={doForgot} className="glass-card glass p-4 space-y-3">
          <label className="block text-sm">
            <span className="block mb-1">Email</span>
            <input type="email" className="input" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <button className="btn" disabled={busy} type="submit">{busy?'Sending…':'Send reset email'}</button>
        </form>
      )}
    </div>
  );
}
