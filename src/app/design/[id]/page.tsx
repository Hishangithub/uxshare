"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { toFigmaEmbed } from "@/lib/figma";

type Design = {
  id: string;
  title: string;
  description: string | null;
  stage: string | null;
  category: string | null;
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

type Ratings = {
  usability?: number;
  visual?: number;
  copy?: number;
};

type Feedback = {
  id: string;
  design_id: string;
  user_id: string | null;
  ratings: Ratings | null;
  pros: string | null;
  cons: string | null;
  suggestions: string | null;
  status: string | null;
  created_at: string;
  body: string | null;
};

type Upvote = {
  id: string;
  user_id: string;
  feedback_id: string;
};

type ModerationResponse = {
  action: "ALLOW" | "NUDGE" | "BLOCK";
  rule_hits: string[];
  suggestion: string | null;
  event_id: string | null;
  db_error?: string | null;
  severity_score?: number;
  model_scores?: {
    engine?: string;
    severity_score?: number;
    toxicity_score?: number;
    negativity_score?: number;
    style_score?: number;
    features?: Record<string, unknown>;
  } | null;
};

function categoryLabel(category: string | null) {
  if (category === "PRODUCT") return "Product";
  return "Web";
}

function ratingValue(value: number | undefined) {
  if (!value) return "Not rated";
  return `${value}/5`;
}

export default function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [design, setDesign] = useState<Design | null>(null);
  const [author, setAuthor] = useState<ProfileMini | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [upvotes, setUpvotes] = useState<Upvote[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [usabilityRating, setUsabilityRating] = useState("3");
  const [visualRating, setVisualRating] = useState("3");
  const [copyRating, setCopyRating] = useState("3");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [suggestions, setSuggestions] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [nudgeNotice, setNudgeNotice] = useState<string | null>(null);
  const [blockNotice, setBlockNotice] = useState<string | null>(null);

  const figmaEmbed = useMemo(() => {
    if (!design?.figma_url) return null;
    return toFigmaEmbed(design.figma_url);
  }, [design?.figma_url]);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user ?? null;
    setCurrentUserId(user?.id ?? null);

    const { data: designData, error: designError } = await supabase
      .from("designs")
      .select(
        "id,title,description,stage,category,media_urls,figma_url,created_at,user_id"
      )
      .eq("id", id)
      .maybeSingle();

    if (designError) {
      setMsg("❌ " + designError.message);
      setDesign(null);
      setLoading(false);
      return;
    }

    const loadedDesign = designData as Design | null;

    if (!loadedDesign) {
      setDesign(null);
      setLoading(false);
      return;
    }

    const normalizedDesign: Design = {
      ...loadedDesign,
      category: loadedDesign.category === "PRODUCT" ? "PRODUCT" : "WEB",
    };

    setDesign(normalizedDesign);

    if (normalizedDesign.user_id) {
      const { data: authorData } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .eq("id", normalizedDesign.user_id)
        .maybeSingle();

      setAuthor((authorData as ProfileMini) ?? null);
    } else {
      setAuthor(null);
    }

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select(
        "id,design_id,user_id,ratings,pros,cons,suggestions,status,created_at,body"
      )
      .eq("design_id", id)
      .order("created_at", { ascending: true });

    if (feedbackError) {
      setMsg("❌ " + feedbackError.message);
      setFeedback([]);
      setProfiles({});
      setUpvotes([]);
      setLoading(false);
      return;
    }

    const feedbackRows = (feedbackData as Feedback[]) ?? [];
    setFeedback(feedbackRows);

    const feedbackUserIds = Array.from(
      new Set(feedbackRows.map((f) => f.user_id).filter(Boolean) as string[])
    );

    if (feedbackUserIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .in("id", feedbackUserIds);

      const profileMap: Record<string, ProfileMini> = {};

      for (const p of (profileData as ProfileMini[]) ?? []) {
        profileMap[p.id] = p;
      }

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    const feedbackIds = feedbackRows.map((f) => f.id);

    if (feedbackIds.length > 0) {
      const { data: upvoteData } = await supabase
        .from("upvotes")
        .select("id,user_id,feedback_id")
        .in("feedback_id", feedbackIds);

      setUpvotes((upvoteData as Upvote[]) ?? []);
    } else {
      setUpvotes([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]);

  function profileLabel(userId: string | null) {
    if (!userId) return "Unknown user";

    const p = profiles[userId];

    if (!p) return "Unknown user";
    if (p.username) return `@${p.username}`;

    return p.full_name ?? "Anonymous";
  }

  function authorLabel() {
    if (!author) return "Unknown user";
    if (author.username) return `@${author.username}`;
    return author.full_name ?? "Anonymous";
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function countUpvotes(feedbackId: string) {
    return upvotes.filter((u) => u.feedback_id === feedbackId).length;
  }

  function hasUpvoted(feedbackId: string) {
    if (!currentUserId) return false;

    return upvotes.some(
      (u) => u.feedback_id === feedbackId && u.user_id === currentUserId
    );
  }

  async function toggleUpvote(feedbackId: string) {
    setMsg(null);

    if (!currentUserId) {
      setMsg("Please sign in to upvote feedback.");
      return;
    }

    const existing = upvotes.find(
      (u) => u.feedback_id === feedbackId && u.user_id === currentUserId
    );

    if (existing) {
      const { error } = await supabase
        .from("upvotes")
        .delete()
        .eq("id", existing.id);

      if (error) {
        setMsg("❌ " + error.message);
        return;
      }

      setUpvotes((prev) => prev.filter((u) => u.id !== existing.id));
      return;
    }

    const { data, error } = await supabase
      .from("upvotes")
      .insert([
        {
          feedback_id: feedbackId,
          user_id: currentUserId,
        },
      ])
      .select("id,user_id,feedback_id")
      .single();

    if (error) {
      setMsg("❌ " + error.message);
      return;
    }

    if (data) {
      setUpvotes((prev) => [...prev, data as Upvote]);
    }
  }

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();

    setMsg(null);
    setNudgeNotice(null);
    setBlockNotice(null);

    const cleanPros = pros.trim();
    const cleanCons = cons.trim();
    const cleanSuggestions = suggestions.trim();

    if (!cleanPros && !cleanCons && !cleanSuggestions) {
      setMsg("Please write at least one piece of feedback before submitting.");
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user ?? null;

    if (!user) {
      setMsg("Please sign in to submit feedback.");
      return;
    }

    const combinedFeedbackText = [
      `Pros: ${cleanPros}`,
      `Cons: ${cleanCons}`,
      `Suggestions: ${cleanSuggestions}`,
    ]
      .join("\n")
      .trim();

    setSubmitting(true);

    try {
      const moderationResponse = await fetch("/api/moderate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: combinedFeedbackText,
          designId: id,
          userId: user.id,
        }),
      });

      const moderation =
        (await moderationResponse.json()) as ModerationResponse;

      if (moderation.action === "BLOCK") {
        setBlockNotice(
          moderation.suggestion ??
            "Your feedback was blocked because it contains inappropriate language."
        );
        setSubmitting(false);
        return;
      }

      if (moderation.action === "NUDGE") {
        setNudgeNotice(
          moderation.suggestion ??
            "Try rewording your feedback in a more constructive way."
        );
      }

      const ratings: Ratings = {
        usability: Number(usabilityRating),
        visual: Number(visualRating),
        copy: Number(copyRating),
      };

      const { data: insertedFeedback, error: insertError } = await supabase
        .from("feedback")
        .insert([
          {
            design_id: id,
            user_id: user.id,
            ratings,
            pros: cleanPros || null,
            cons: cleanCons || null,
            suggestions: cleanSuggestions || null,
            status: "PUBLIC",
            body: combinedFeedbackText,
          },
        ])
        .select(
          "id,design_id,user_id,ratings,pros,cons,suggestions,status,created_at,body"
        )
        .single();

      if (insertError) {
        setMsg("❌ " + insertError.message);
        setSubmitting(false);
        return;
      }

      const inserted = insertedFeedback as Feedback;

      if (moderation.event_id) {
        await supabase
          .from("moderation_events")
          .update({
            feedback_id: inserted.id,
            target_id: id,
            target_type: "FEEDBACK",
          })
          .eq("id", moderation.event_id);
      }

      setFeedback((prev) => [...prev, inserted]);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfiles((prev) => ({
          ...prev,
          [user.id]: profileData as ProfileMini,
        }));
      }

      setPros("");
      setCons("");
      setSuggestions("");
      setUsabilityRating("3");
      setVisualRating("3");
      setCopyRating("3");
      setMsg("✅ Feedback submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-neutral-300">Loading design…</p>;
  }

  if (!design) {
    return (
      <div className="space-y-4">
        <Link href="/designs" className="btn">
          ← Back to designs
        </Link>

        <div className="glass-card glass p-5">
          <p className="text-neutral-300">Design not found.</p>
        </div>
      </div>
    );
  }

  const image = design.media_urls?.[0] ?? null;
  const authorName = authorLabel();

  return (
    <div className="space-y-6">
      <Link href="/designs" className="btn">
        ← Back to designs
      </Link>

      <article className="glass-card glass overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span className="chip">{categoryLabel(design.category)}</span>

              {design.stage && <span className="chip">{design.stage}</span>}

              <span>{new Date(design.created_at).toLocaleString()}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              {design.title}
            </h1>

            {design.user_id && (
              <Link
                href={`/profile/${design.user_id}`}
                className="inline-flex items-center gap-2 text-sm hover:underline"
              >
                {author?.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={authorName}
                    className="h-8 w-8 rounded-full object-cover border border-neutral-800"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center text-[10px] font-semibold">
                    {initials(authorName)}
                  </div>
                )}

                <span>{authorName}</span>
              </Link>
            )}
          </div>

          {design.description ? (
            <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-6">
              {design.description}
            </p>
          ) : (
            <p className="text-sm text-neutral-500">No description.</p>
          )}
        </div>

        <div className="preview-frame">
          {figmaEmbed ? (
            <iframe
              src={figmaEmbed}
              className="w-full h-[560px]"
              allowFullScreen
            />
          ) : image ? (
            <img
              src={image}
              alt={design.title}
              className="w-full max-h-[680px] object-contain bg-neutral-900"
            />
          ) : (
            <div className="h-96 w-full bg-neutral-900 grid place-items-center text-neutral-600">
              No preview
            </div>
          )}
        </div>
      </article>

      {msg && <p className="glass-card glass px-3 py-2 text-sm">{msg}</p>}

      <section className="glass-card glass p-5 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Add your feedback</h2>
          <p className="text-sm text-neutral-400">
            Rate the design and give structured feedback.
          </p>
        </div>

        {blockNotice && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {blockNotice}
          </div>
        )}

        {nudgeNotice && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {nudgeNotice}
          </div>
        )}

        <form onSubmit={submitFeedback} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Usability</span>
              <select
                className="select"
                value={usabilityRating}
                onChange={(e) => setUsabilityRating(e.target.value)}
              >
                <option value="1">1 - Poor</option>
                <option value="2">2 - Needs work</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Very good</option>
                <option value="5">5 - Excellent</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Visual design</span>
              <select
                className="select"
                value={visualRating}
                onChange={(e) => setVisualRating(e.target.value)}
              >
                <option value="1">1 - Poor</option>
                <option value="2">2 - Needs work</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Very good</option>
                <option value="5">5 - Excellent</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Copy / clarity</span>
              <select
                className="select"
                value={copyRating}
                onChange={(e) => setCopyRating(e.target.value)}
              >
                <option value="1">1 - Poor</option>
                <option value="2">2 - Needs work</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Very good</option>
                <option value="5">5 - Excellent</option>
              </select>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              What works well?
            </label>
            <textarea
              className="textarea"
              rows={3}
              value={pros}
              onChange={(e) => setPros(e.target.value)}
              placeholder="Example: The spacing is clean and the visual hierarchy is clear."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              What could be improved?
            </label>
            <textarea
              className="textarea"
              rows={3}
              value={cons}
              onChange={(e) => setCons(e.target.value)}
              placeholder="Example: The CTA button could use stronger contrast."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Suggestions
            </label>
            <textarea
              className="textarea"
              rows={3}
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder="Example: Increase contrast, reduce spacing in the header, and align the grid."
            />
          </div>

          <button
            className="btn gradient-fill-btn"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Feedback</h2>

        {feedback.length === 0 ? (
          <div className="glass-card glass p-4">
            <p className="text-sm text-neutral-400">
              No feedback has been posted yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map((f) => {
              const label = profileLabel(f.user_id);
              const avatar = f.user_id
                ? profiles[f.user_id]?.avatar_url ?? null
                : null;

              return (
                <article key={f.id} className="glass-card glass p-4 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {f.user_id ? (
                      <Link
                        href={`/profile/${f.user_id}`}
                        className="inline-flex items-center gap-2 text-sm hover:underline"
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={label}
                            className="h-8 w-8 rounded-full object-cover border border-neutral-800"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-neutral-800 grid place-items-center text-[10px] font-semibold">
                            {initials(label)}
                          </div>
                        )}

                        <span>{label}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-neutral-400">
                        Unknown user
                      </span>
                    )}

                    <span className="text-xs text-neutral-500">
                      {new Date(f.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="glass rounded-2xl px-3 py-2 text-sm">
                      <p className="text-xs text-neutral-500">Usability</p>
                      <p className="font-semibold">
                        {ratingValue(f.ratings?.usability)}
                      </p>
                    </div>

                    <div className="glass rounded-2xl px-3 py-2 text-sm">
                      <p className="text-xs text-neutral-500">Visual design</p>
                      <p className="font-semibold">
                        {ratingValue(f.ratings?.visual)}
                      </p>
                    </div>

                    <div className="glass rounded-2xl px-3 py-2 text-sm">
                      <p className="text-xs text-neutral-500">Copy / clarity</p>
                      <p className="font-semibold">
                        {ratingValue(f.ratings?.copy)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm leading-6">
                    <div>
                      <p className="font-semibold text-neutral-100">
                        What works well
                      </p>
                      <p className="whitespace-pre-wrap text-neutral-300">
                        {f.pros || "No pros added."}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-neutral-100">
                        What could be improved
                      </p>
                      <p className="whitespace-pre-wrap text-neutral-300">
                        {f.cons || "No cons added."}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-neutral-100">
                        Suggestions
                      </p>
                      <p className="whitespace-pre-wrap text-neutral-300">
                        {f.suggestions || "No suggestions added."}
                      </p>
                    </div>
                  </div>

                  <button
                    className={`btn ${
                      hasUpvoted(f.id) ? "bg-neutral-100 text-neutral-900" : ""
                    }`}
                    onClick={() => void toggleUpvote(f.id)}
                    type="button"
                  >
                    ▲ {countUpvotes(f.id)}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}