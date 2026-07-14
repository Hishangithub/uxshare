"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Ratings = {
  usability?: number;
  visual?: number;
  copy?: number;
};

type Design = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  media_urls: string[] | null;
  figma_url: string | null;
  created_at: string | null;
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

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Upvote = {
  id: string;
  feedback_id: string;
  user_id: string;
};

type ModerationResult = {
  action: "ALLOW" | "NUDGE" | "BLOCK";
  rule_hits: string[];
  suggestion: string | null;
  severity_score: number;
  model_scores: unknown;
  event_id: string | null;
  db_error: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function profileLabel(profile: Profile | undefined) {
  if (!profile) return "Anonymous";
  if (profile.username) return `@${profile.username}`;
  return profile.full_name ?? "Anonymous";
}

function ratingLabel(value: number | undefined) {
  if (!value) return "Not rated";
  return `${value}/5`;
}

function isFigmaUrl(url: string | null | undefined) {
  if (!url) return false;
  return url.includes("figma.com");
}

function getFigmaEmbedUrl(url: string) {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(
    url
  )}`;
}

export default function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [design, setDesign] = useState<Design | null>(null);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [upvotes, setUpvotes] = useState<Upvote[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [usability, setUsability] = useState("");
  const [visual, setVisual] = useState("");
  const [copy, setCopy] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [suggestions, setSuggestions] = useState("");

  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [formWarning, setFormWarning] = useState<string | null>(null);
  const [moderationWarning, setModerationWarning] = useState<string | null>(
    null
  );

  const mediaUrls = useMemo(() => design?.media_urls ?? [], [design]);

  const upvoteCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const upvote of upvotes) {
      counts[upvote.feedback_id] = (counts[upvote.feedback_id] ?? 0) + 1;
    }

    return counts;
  }, [upvotes]);

  const userUpvotes = useMemo(() => {
    const map: Record<string, boolean> = {};

    for (const upvote of upvotes) {
      if (upvote.user_id === currentUserId) {
        map[upvote.feedback_id] = true;
      }
    }

    return map;
  }, [upvotes, currentUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setCurrentUserId(uid);

    const { data: designData, error: designError } = await supabase
      .from("designs")
      .select(
        "id,user_id,title,description,category,media_urls,figma_url,created_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (designError) {
      setMsg("❌ " + designError.message);
      setDesign(null);
      setLoading(false);
      return;
    }

    setDesign((designData as Design) ?? null);

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select(
        "id,design_id,user_id,ratings,pros,cons,suggestions,status,created_at,body"
      )
      .eq("design_id", id)
      .eq("status", "PUBLIC")
      .order("created_at", { ascending: false });

    if (feedbackError) {
      setMsg("❌ " + feedbackError.message);
      setFeedback([]);
      setLoading(false);
      return;
    }

    const feedbackRows = ((feedbackData ?? []) as Feedback[]).filter(
      (item) => item.status !== "REMOVED"
    );

    setFeedback(feedbackRows);

    const userIds = Array.from(
      new Set(
        [
          designData?.user_id,
          ...feedbackRows.map((item) => item.user_id),
        ].filter(Boolean) as string[]
      )
    );

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .in("id", userIds);

      const profileMap: Record<string, Profile> = {};

      for (const profile of (profileData as Profile[]) ?? []) {
        profileMap[profile.id] = profile;
      }

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    if (feedbackRows.length > 0) {
      const feedbackIds = feedbackRows.map((item) => item.id);

      const { data: upvoteData } = await supabase
        .from("upvotes")
        .select("id,feedback_id,user_id")
        .in("feedback_id", feedbackIds);

      setUpvotes((upvoteData as Upvote[]) ?? []);
    } else {
      setUpvotes([]);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);
    setFormWarning(null);
    setModerationWarning(null);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      setMsg("Please log in to submit feedback.");
      return;
    }

    if (!usability || !visual || !copy) {
      setFormWarning(
        "Please select a rating for usability, visual design, and copy before submitting."
      );
      return;
    }

    const cleanPros = pros.trim();
    const cleanCons = cons.trim();
    const cleanSuggestions = suggestions.trim();

    if (!cleanPros && !cleanCons && !cleanSuggestions) {
      setFormWarning("Please write at least one piece of feedback.");
      return;
    }

    setPosting(true);

    const ratings: Ratings = {
      usability: Number(usability),
      visual: Number(visual),
      copy: Number(copy),
    };

    const combinedFeedbackText = [
      `Pros: ${cleanPros}`,
      `Cons: ${cleanCons}`,
      `Suggestions: ${cleanSuggestions}`,
    ]
      .join("\n")
      .trim();

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

      const moderation = (await moderationResponse.json()) as ModerationResult;

      if (moderation.action === "BLOCK") {
        setMsg(
          moderation.suggestion ??
            "Your feedback was blocked. Please rewrite it respectfully."
        );
        setPosting(false);
        return;
      }

      if (moderation.action === "NUDGE") {
        setModerationWarning(
          moderation.suggestion ??
            "Your feedback was posted, but please try to keep feedback constructive."
        );
      }

      const { data: insertedFeedback, error } = await supabase
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

      if (error) {
        setMsg("❌ " + error.message);
        setPosting(false);
        return;
      }

      if (moderation.event_id && insertedFeedback?.id) {
        await supabase
          .from("moderation_events")
          .update({
            feedback_id: insertedFeedback.id,
          })
          .eq("id", moderation.event_id);
      }

      setPros("");
      setCons("");
      setSuggestions("");
      setUsability("");
      setVisual("");
      setCopy("");

      setMsg("✅ Feedback posted.");
      setPosting(false);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMsg("❌ " + message);
      setPosting(false);
    }
  }

  async function toggleUpvote(feedbackId: string) {
    if (!currentUserId) {
      setMsg("Please log in to upvote feedback.");
      return;
    }

    const alreadyUpvoted = userUpvotes[feedbackId];

    if (alreadyUpvoted) {
      const { error } = await supabase
        .from("upvotes")
        .delete()
        .eq("feedback_id", feedbackId)
        .eq("user_id", currentUserId);

      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("upvotes").insert([
        {
          feedback_id: feedbackId,
          user_id: currentUserId,
        },
      ]);

      if (error) {
        setMsg("❌ " + error.message);
        return;
      }
    }

    await load();
  }

  if (loading) {
    return <p className="text-neutral-300">Loading design…</p>;
  }

  if (!design) {
    return (
      <div className="space-y-4">
        <div className="glass-card glass p-5">
          <h1 className="text-2xl font-semibold">Design not found</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This design may have been removed or does not exist.
          </p>
        </div>

        <Link href="/designs" className="btn">
          ← Back to designs
        </Link>
      </div>
    );
  }

  const author = design.user_id ? profiles[design.user_id] : undefined;

  return (
    <div className="space-y-6">
      <Link href="/designs" className="btn">
        ← Back to designs
      </Link>

      <section className="glass-card glass p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="chip w-fit">{design.category ?? "Design"}</p>

            <h1 className="mt-3 hero-title text-4xl sm:text-5xl font-semibold">
              {design.title}
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              Posted by{" "}
              {design.user_id ? (
                <Link
                  href={`/profile/${design.user_id}`}
                  className="font-semibold text-neutral-200 hover:underline"
                >
                  {profileLabel(author)}
                </Link>
              ) : (
                "Anonymous"
              )}
              {design.created_at ? ` · ${formatDate(design.created_at)}` : ""}
            </p>
          </div>
        </div>

        {design.description && (
          <p className="max-w-3xl leading-7 text-neutral-300">
            {design.description}
          </p>
        )}

        {isFigmaUrl(design.figma_url) && (
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/30">
            <iframe
              title="Figma preview"
              src={getFigmaEmbedUrl(design.figma_url as string)}
              className="h-[760px] min-h-[760px] w-full"
              allowFullScreen
            />
          </div>
        )}

        {mediaUrls.length > 0 && (
          <div className="grid gap-4">
            {mediaUrls.map((url) => (
              <div
                key={url}
                className="overflow-hidden rounded-3xl border border-white/10 bg-black/30"
              >
                <img
                  src={url}
                  alt={design.title}
                  className="w-full object-contain"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {msg && <p className="glass-card glass px-3 py-2 text-sm">{msg}</p>}

      {formWarning && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
          {formWarning}
        </div>
      )}

      {moderationWarning && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {moderationWarning}
        </div>
      )}

      <section className="glass-card glass p-5">
        <h2 className="text-2xl font-semibold">Leave structured feedback</h2>

        {!currentUserId ? (
          <p className="mt-2 text-sm text-neutral-400">
            Please{" "}
            <Link href="/login" className="font-semibold hover:underline">
              log in
            </Link>{" "}
            to submit feedback.
          </p>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submitFeedback}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="text-neutral-300">Usability</span>
                <select
                  className="input select-input"
                  value={usability}
                  onChange={(event) => setUsability(event.target.value)}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2</option>
                  <option value="3">3 - Okay</option>
                  <option value="4">4</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-neutral-300">Visual design</span>
                <select
                  className="input select-input"
                  value={visual}
                  onChange={(event) => setVisual(event.target.value)}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2</option>
                  <option value="3">3 - Okay</option>
                  <option value="4">4</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-neutral-300">Copy / clarity</span>
                <select
                  className="input select-input"
                  value={copy}
                  onChange={(event) => setCopy(event.target.value)}
                >
                  <option value="" disabled hidden>
                    Select
                  </option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2</option>
                  <option value="3">3 - Okay</option>
                  <option value="4">4</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </label>
            </div>

            <label className="block space-y-2 text-sm">
              <span className="text-neutral-300">What works well?</span>
              <textarea
                className="input min-h-24"
                value={pros}
                onChange={(event) => setPros(event.target.value)}
                placeholder="Mention the strengths of the design..."
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-neutral-300">What could be improved?</span>
              <textarea
                className="input min-h-24"
                value={cons}
                onChange={(event) => setCons(event.target.value)}
                placeholder="Mention usability, layout, hierarchy, or clarity issues..."
              />
            </label>

            <label className="block space-y-2 text-sm">
              <span className="text-neutral-300">Suggestions</span>
              <textarea
                className="input min-h-24"
                value={suggestions}
                onChange={(event) => setSuggestions(event.target.value)}
                placeholder="Suggest practical improvements..."
              />
            </label>

            <button
              disabled={posting}
              className="btn gradient-fill-btn"
              type="submit"
            >
              {posting ? "Submitting…" : "Submit feedback"}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Feedback</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Removed feedback is hidden from this public design page.
          </p>
        </div>

        {feedback.length === 0 ? (
          <div className="glass-card glass p-5">
            <p className="text-sm text-neutral-400">
              No public feedback yet. Be the first to comment.
            </p>
          </div>
        ) : (
          feedback.map((item) => {
            const profile = item.user_id ? profiles[item.user_id] : undefined;

            return (
              <article key={item.id} className="glass-card glass p-5 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {item.user_id ? (
                        <Link
                          href={`/profile/${item.user_id}`}
                          className="hover:underline"
                        >
                          {profileLabel(profile)}
                        </Link>
                      ) : (
                        "Anonymous"
                      )}
                    </p>

                    <p className="mt-1 text-xs text-neutral-500">
                      {formatDate(item.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() => void toggleUpvote(item.id)}
                  >
                    {userUpvotes[item.id] ? "Upvoted" : "Upvote"} ·{" "}
                    {upvoteCounts[item.id] ?? 0}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Usability</p>
                    <p className="mt-1 font-semibold">
                      {ratingLabel(item.ratings?.usability)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Visual</p>
                    <p className="mt-1 font-semibold">
                      {ratingLabel(item.ratings?.visual)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Copy</p>
                    <p className="mt-1 font-semibold">
                      {ratingLabel(item.ratings?.copy)}
                    </p>
                  </div>
                </div>

                {item.pros && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      What works well
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                      {item.pros}
                    </p>
                  </div>
                )}

                {item.cons && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      What could be improved
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                      {item.cons}
                    </p>
                  </div>
                )}

                {item.suggestions && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Suggestions
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                      {item.suggestions}
                    </p>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}