"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toFigmaEmbed } from "@/lib/figma";

type Category = "ALL" | "PRODUCT" | "WEB";

type Design = {
  id: string;
  title: string;
  description: string | null;
  stage: string | null;
  category: "PRODUCT" | "WEB" | string | null;
  media_urls: string[] | null;
  figma_url: string | null;
  created_at: string;
  user_id: string | null;
};

type ProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function categoryLabel(category: string | null) {
  if (category === "PRODUCT") return "Product";
  return "Web";
}

export default function DesignsPage() {
  const router = useRouter();

  const [designs, setDesigns] = useState<Design[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<Category>("ALL");
  const [showUpload, setShowUpload] = useState(false);
  const [clickingId, setClickingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState("WIREFRAME");
  const [category, setCategory] = useState<"PRODUCT" | "WEB">("WEB");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function openDesign(id: string) {
    setClickingId(id);

    setTimeout(() => {
      router.push(`/design/${id}`);
    }, 130);
  }

  async function ensureProfile() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      return {
        user: null,
        error: "Please sign in to upload.",
      };
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("profiles").insert([
        {
          id: user.id,
          full_name: user.email ?? "User",
          role: "USER",
        },
      ]);

      if (error) {
        return {
          user,
          error: error.message,
        };
      }
    }

    return {
      user,
      error: null,
    };
  }

  async function loadDesigns() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("designs")
      .select(
        "id,title,description,stage,category,media_urls,figma_url,created_at,user_id"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setDesigns([]);
      setLoading(false);
      return;
    }

    const rows = ((data as Design[]) ?? []).map((d) => ({
      ...d,
      category: d.category === "PRODUCT" ? "PRODUCT" : "WEB",
    }));

    setDesigns(rows);

    const userIds = Array.from(
      new Set(rows.map((d) => d.user_id).filter(Boolean) as string[])
    );

    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .in("id", userIds);

      const map: Record<string, ProfileMini> = {};

      for (const p of (profs as ProfileMini[]) ?? []) {
        map[p.id] = p;
      }

      setProfiles(map);
    } else {
      setProfiles({});
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadDesigns();
  }, []);

  const shown = useMemo(() => {
    if (filter === "ALL") return designs;
    return designs.filter((d) => d.category === filter);
  }, [designs, filter]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!title.trim()) {
      setMsg("Please enter a title.");
      return;
    }

    const ensured = await ensureProfile();

    if (!ensured.user) {
      setMsg(ensured.error);
      return;
    }

    if (ensured.error) {
      setMsg("❌ " + ensured.error);
      return;
    }

    try {
      setUploading(true);

      const mediaUrls: string[] = [];

      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${ensured.user.id}/${Date.now()}-${safeName}`;

        const upload = await supabase.storage
          .from("designs")
          .upload(path, file, {
            upsert: false,
          });

        if (upload.error) {
          setMsg("❌ " + upload.error.message);
          return;
        }

        const { data } = supabase.storage.from("designs").getPublicUrl(path);
        mediaUrls.push(data.publicUrl);
      }

      const insert = await supabase.from("designs").insert([
        {
          title: title.trim(),
          description: description.trim(),
          stage,
          category,
          figma_url: figmaUrl.trim() || null,
          media_urls: mediaUrls.length ? mediaUrls : null,
          user_id: ensured.user.id,
        },
      ]);

      if (insert.error) {
        setMsg("❌ " + insert.error.message);
        return;
      }

      setMsg("✅ Design uploaded.");
      setTitle("");
      setDescription("");
      setStage("WIREFRAME");
      setCategory("WEB");
      setFigmaUrl("");
      setFile(null);
      setShowUpload(false);
      await loadDesigns();
    } finally {
      setUploading(false);
    }
  }

  function profileLabel(userId: string | null) {
    if (!userId) return "Unknown user";

    const p = profiles[userId];

    if (!p) return "Unknown user";
    if (p.username) return `@${p.username}`;

    return p.full_name ?? "Anonymous";
  }

  function profileAvatar(userId: string | null) {
    if (!userId) return null;
    return profiles[userId]?.avatar_url ?? null;
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <p className="chip w-fit">UXShare Community</p>

          <div className="space-y-2">
            <h1 className="hero-title text-5xl sm:text-6xl font-semibold">
              Explore better design.
            </h1>

            <p className="hero-subtitle max-w-2xl text-base sm:text-lg">
              Browse UI products and web designs, preview designs instantly, and
              share clear feedback with the community.
            </p>
          </div>
        </div>

        <button
          className="btn gradient-fill-btn shrink-0"
          onClick={() => setShowUpload((v) => !v)}
        >
          {showUpload ? "Close upload" : "Upload design"}
        </button>
      </section>

      {!showUpload && (
        <section className="flex flex-wrap items-center gap-2">
          {(["ALL", "PRODUCT", "WEB"] as Category[]).map((c) => (
            <button
              key={c}
              className={`btn gradient-outline-btn category-filter-btn ${
                filter === c ? "is-active" : ""
              }`}
              onClick={() => setFilter(c)}
            >
              {c === "ALL" ? "All" : c === "PRODUCT" ? "Product" : "Web"}
            </button>
          ))}
        </section>
      )}

      {showUpload && (
        <section className="glass-card glass p-5">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Upload a design</h2>
            <p className="text-sm text-neutral-400">
              Share a product design, web design, image, or Figma preview with
              the UXShare community.
            </p>
          </div>

          {msg && (
            <p className="text-sm glass-card glass px-3 py-2 mb-3">{msg}</p>
          )}

          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Mobile banking dashboard"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Description
              </label>
              <textarea
                className="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the design and what kind of feedback you want."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="block mb-1 font-medium">Stage</span>
                <select
                  className="select"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option value="WIREFRAME">Wireframe</option>
                  <option value="HIFI">High fidelity</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="block mb-1 font-medium">Category</span>
                <select
                  className="select"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as "PRODUCT" | "WEB")
                  }
                >
                  <option value="PRODUCT">Product</option>
                  <option value="WEB">Web</option>
                </select>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Image</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Figma URL</label>
              <input
                className="input"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="Optional Figma link"
              />
            </div>

            <button
                disabled={uploading}
                className="btn gradient-fill-btn"
                type="submit"
                  >
               {uploading ? "Uploading…" : "Post design"}
            </button>
          </form>
        </section>
      )}

      {msg && !showUpload && (
        <p className="text-sm glass-card glass px-3 py-2">{msg}</p>
      )}

      {loading ? (
        <p className="text-neutral-300">Loading designs…</p>
      ) : err ? (
        <p className="glass-card glass px-3 py-2 text-red-300">
          Error loading designs: {err}
        </p>
      ) : shown.length === 0 ? (
        <div className="glass-card glass p-5">
          <p className="text-neutral-300">No designs found.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((d) => {
            const img = d.media_urls?.[0] ?? null;
            const figmaEmbed = d.figma_url ? toFigmaEmbed(d.figma_url) : null;
            const author = profileLabel(d.user_id);
            const avatar = profileAvatar(d.user_id);

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
                <div className="p-5 space-y-4">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold tracking-tight truncate">
                      {d.title}
                    </h2>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                      <span className="chip">{categoryLabel(d.category)}</span>

                      {d.stage && <span className="chip">{d.stage}</span>}

                      <span>{new Date(d.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {d.user_id && (
                    <Link
                      href={`/profile/${d.user_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm hover:underline"
                    >
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={author}
                          className="h-8 w-8 rounded-full object-cover border border-neutral-800"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center text-[10px] font-semibold">
                          {initials(author)}
                        </div>
                      )}

                      <span>{author}</span>
                    </Link>
                  )}

                  {d.description ? (
                    <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-6">
                      {d.description}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-500">No description.</p>
                  )}
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
                      className="w-full max-h-[520px] object-contain bg-neutral-900"
                    />
                  ) : (
                    <div className="h-72 w-full bg-neutral-900 grid place-items-center text-neutral-600">
                      No preview
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}