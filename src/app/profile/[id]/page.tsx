"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toFigmaEmbed } from "@/lib/figma";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  role: string | null;
  avatar_url: string | null;
};

type Design = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  media_urls: string[] | null;
  figma_url: string | null;
  created_at: string;
};

function categoryLabel(category: string | null) {
  if (category === "PRODUCT") return "Product";
  return "Web";
}

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMine, setIsMine] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function openDesign(designId: string) {
    setClickingId(designId);

    setTimeout(() => {
      router.push(`/design/${designId}`);
    }, 130);
  }

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth.user ?? null;
    const mine = currentUser?.id === id;

    setIsMine(mine);

    let { data: prof } = await supabase
      .from("profiles")
      .select("id,username,full_name,bio,role,avatar_url")
      .eq("id", id)
      .maybeSingle();

    if (!prof && mine && currentUser) {
      const { error } = await supabase.from("profiles").insert([
        {
          id: currentUser.id,
          full_name: currentUser.email ?? "User",
          role: "USER",
        },
      ]);

      if (error) {
        setMsg("❌ " + error.message);
      }

      const reload = await supabase
        .from("profiles")
        .select("id,username,full_name,bio,role,avatar_url")
        .eq("id", id)
        .maybeSingle();

      prof = reload.data;
    }

    const p = (prof as Profile) ?? null;

    setProfile(p);

    if (p) {
      setUsername(p.username ?? "");
      setFullName(p.full_name ?? "");
      setBio(p.bio ?? "");
    }

    const { data: ds } = await supabase
      .from("designs")
      .select("id,title,description,category,media_urls,figma_url,created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    const rows = ((ds as Design[]) ?? []).map((d) => ({
      ...d,
      category: d.category === "PRODUCT" ? "PRODUCT" : "WEB",
    }));

    setDesigns(rows);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]);

  function displayName(p: Profile) {
    if (p.username) return `@${p.username}`;
    return p.full_name ?? "Anonymous";
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    if (!profile || !isMine) return;

    setSaving(true);
    setMsg(null);

    let avatarUrl = profile.avatar_url;

    if (avatarFile) {
      const safeName = avatarFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `avatars/${profile.id}/${Date.now()}-${safeName}`;

      const upload = await supabase.storage
        .from("designs")
        .upload(path, avatarFile, {
          upsert: false,
        });

      if (upload.error) {
        setMsg("❌ " + upload.error.message);
        setSaving(false);
        return;
      }

      const { data } = supabase.storage.from("designs").getPublicUrl(path);
      avatarUrl = data.publicUrl;
    }

    const cleanUsername = username.trim().replace(/^@/, "");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername || null,
        full_name: fullName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);

    if (error) {
      setMsg("❌ " + error.message);
      setSaving(false);
      return;
    }

    setMsg("✅ Profile updated.");
    setAvatarFile(null);
    await load();
    setSaving(false);
  }

  if (loading) return <p>Loading…</p>;

  if (!profile) {
    return (
      <div className="space-y-2">
        <p>Profile not found.</p>
        <Link href="/users" className="underline">
          Back to users
        </Link>
      </div>
    );
  }

  const name = displayName(profile);

  return (
    <div className="space-y-6">
      <section className="glass-card glass p-5">
        <div className="flex items-start gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              className="h-20 w-20 rounded-full object-cover border border-neutral-800"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-neutral-800 grid place-items-center text-xl font-semibold">
              {initials(name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{name}</h1>

            {profile.full_name && profile.username && (
              <p className="text-sm text-neutral-400">{profile.full_name}</p>
            )}

            <p className="mt-3 text-neutral-200 whitespace-pre-wrap">
              {profile.bio || "No bio added yet."}
            </p>

            {isMine && (
              <p className="mt-2 text-xs text-neutral-500">
                Role: {(profile.role ?? "USER").toUpperCase()}
              </p>
            )}
          </div>
        </div>
      </section>

      {isMine && (
        <section className="glass-card glass p-4">
          <h2 className="font-semibold mb-3">Edit profile</h2>

          {msg && (
            <p className="glass-card glass px-3 py-2 text-sm mb-3">{msg}</p>
          )}

          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="block text-sm font-medium">
                Profile picture
              </label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Example: clairux"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Display name</label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Bio</label>
              <textarea
                className="textarea"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio others can see."
              />
            </div>

            <button className="btn" disabled={saving} type="submit">
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">
          {isMine ? "My posts" : "Posted designs"}
        </h2>

        {designs.length === 0 ? (
          <div className="glass-card glass p-4">
            <p className="text-sm text-neutral-400">No designs posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {designs.map((d) => {
              const img = d.media_urls?.[0] ?? null;
              const figmaEmbed = d.figma_url ? toFigmaEmbed(d.figma_url) : null;

              return (
                <article
                  key={d.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openDesign(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openDesign(d.id);
                  }}
                  className={`glass-card glass design-click-card overflow-hidden ${
                    clickingId === d.id ? "is-clicking" : ""
                  }`}
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold truncate">
                        {d.title}
                      </h3>

                      <span className="chip shrink-0">
                        {categoryLabel(d.category)}
                      </span>
                    </div>

                    {d.description ? (
                      <p className="text-sm text-neutral-400 whitespace-pre-wrap">
                        {d.description}
                      </p>
                    ) : (
                      <p className="text-sm text-neutral-500">
                        No description.
                      </p>
                    )}

                    <p className="text-xs text-neutral-500">
                      {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="preview-frame">
                    {figmaEmbed ? (
                      <iframe
                        src={figmaEmbed}
                        className="w-full h-[420px]"
                        allowFullScreen
                      />
                    ) : img ? (
                      <img
                        src={img}
                        alt={d.title}
                        className="w-full max-h-[420px] object-contain bg-neutral-900"
                      />
                    ) : (
                      <div className="h-56 bg-neutral-900 grid place-items-center text-neutral-600">
                        No preview
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}