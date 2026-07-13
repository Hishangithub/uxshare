"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ensureProfile from "@/lib/ensureProfile";
import { isFigmaUrl } from "@/lib/figma";

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<"WIREFRAME"|"HIFI">("WIREFRAME");
  const [file, setFile] = useState<File | null>(null);
  const [figma, setFigma] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!file && !figma.trim()) { setMsg("Attach an image or paste a Figma link."); return; }
    if (figma.trim() && !isFigmaUrl(figma.trim())) { setMsg("Enter a valid Figma URL."); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMsg("Please sign in."); return; }
    const ensured = await ensureProfile(supabase);
    if (!ensured.ok) { setMsg("Profile check failed: " + ensured.reason); return; }

    try {
      setSaving(true);
      let mediaUrl: string | null = null;
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("designs").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const pub = supabase.storage.from("designs").getPublicUrl(path);
        mediaUrl = pub.data.publicUrl;
      }

      const { error: insErr } = await supabase.from("designs").insert([{
        title,
        description,
        stage,
        media_urls: mediaUrl ? [mediaUrl] : null,
        figma_url: figma.trim() || null,
        user_id: user.id
      }]);
      if (insErr) throw insErr;

      setMsg("✅ Uploaded");
      setTitle(""); setDescription(""); setFile(null); setFigma("");
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? "Failed"));
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <Link className="underline text-sm" href="/designs">← Back to designs</Link>
      <h1 className="text-2xl font-bold">Upload design</h1>
      {msg && <p className="text-sm glass-card glass px-3 py-2">{msg}</p>}

      <form onSubmit={handleUpload} className="glass-card glass p-4 space-y-3">
        <label className="block text-sm">
          <span className="block mb-1">Title</span>
          <input className="input" value={title} onChange={e=>setTitle(e.target.value)} required />
        </label>

        <label className="block text-sm">
          <span className="block mb-1">Description</span>
          <textarea className="textarea" rows={3} value={description} onChange={e=>setDescription(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="block mb-1">Stage</span>
          <select className="select" value={stage} onChange={e=>setStage(e.target.value as any)}>
            <option value="WIREFRAME">Wireframe</option>
            <option value="HIFI">Hi-fi</option>
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="block mb-1">Image</span>
            <input
              type="file" accept="image/*"
              onChange={e=>setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-neutral-800 file:bg-neutral-900 file:px-3 file:py-1.5 hover:file:bg-neutral-800"
            />
          </label>

          <label className="block text-sm">
            <span className="block mb-1">Figma link</span>
            <input
              className="input"
              placeholder="https://www.figma.com/file/… or …/proto/…"
              value={figma}
              onChange={e=>setFigma(e.target.value)}
            />
          </label>
        </div>

        <button className="btn" disabled={saving} type="submit">
          {saving ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
