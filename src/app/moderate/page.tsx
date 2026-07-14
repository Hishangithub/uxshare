"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ModerationAction = "ALLOW" | "NUDGE" | "BLOCK";

type ModelScores = {
  engine?: string;
  severity_score?: number;
  toxicity_score?: number;
  negativity_score?: number;
  style_score?: number;
  features?: Record<string, unknown>;
};

type ModerationEvent = {
  id: string;
  target_type: string | null;
  target_id: string | null;
  design_id: string | null;
  feedback_id: string | null;
  user_id: string | null;
  rule_hits: string[] | null;
  model_scores: ModelScores | null;
  action: ModerationAction | string | null;
  suggestion: string | null;
  original_text: string | null;
  reviewed: boolean | null;
  feedback_removed: boolean | null;
  feedback_removed_at: string | null;
  created_at: string | null;
};

type ProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

type DesignMini = {
  id: string;
  title: string;
};

type FeedbackSearchResult = {
  id: string;
  body: string | null;
  pros: string | null;
  cons: string | null;
  suggestions: string | null;
};

function actionLabel(action: string | null) {
  if (action === "ALLOW") return "Allowed";
  if (action === "NUDGE") return "Nudged";
  if (action === "BLOCK") return "Blocked";
  return "Unknown";
}

function actionClass(action: string | null) {
  if (action === "ALLOW") {
    return "border-green-500/30 bg-green-500/10 text-green-200";
  }

  if (action === "NUDGE") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }

  if (action === "BLOCK") {
    return "border-red-500/30 bg-red-500/10 text-red-200";
  }

  return "border-white/10 bg-white/10 text-neutral-300";
}

function formatDate(value: string | null) {
  if (!value) return "Unknown date";
  return new Date(value).toLocaleString();
}

function userLabel(profile: ProfileMini | undefined) {
  if (!profile) return "Unknown user";
  if (profile.username) return `@${profile.username}`;
  return profile.full_name ?? "Anonymous";
}

function scoreValue(value: number | undefined) {
  if (typeof value !== "number") return "0";
  return String(value);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function ModeratePage() {
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [designs, setDesigns] = useState<Record<string, DesignMini>>({});

  const [loading, setLoading] = useState(true);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isModerator, setIsModerator] = useState(false);

  const [filter, setFilter] = useState<"UNREVIEWED" | "ALL">("UNREVIEWED");
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const shownEvents = useMemo(() => {
    if (filter === "ALL") return events;
    return events.filter((event) => !event.reviewed);
  }, [events, filter]);

  const checkModeratorRole = useCallback(async () => {
    setCheckingRole(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user ?? null;

    if (!user) {
      setIsModerator(false);
      setCheckingRole(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(data?.role ?? "").toUpperCase();

    setIsModerator(role === "MODERATOR");
    setCheckingRole(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("moderation_events")
      .select(
        "id,target_type,target_id,design_id,feedback_id,user_id,rule_hits,model_scores,action,suggestion,original_text,reviewed,feedback_removed,feedback_removed_at,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      setMsg("❌ " + error.message);
      setEvents([]);
      setProfiles({});
      setDesigns({});
      setLoading(false);
      return;
    }

    const rows = ((data ?? []) as ModerationEvent[]).map((event) => ({
      ...event,
      rule_hits: event.rule_hits ?? [],
      model_scores: (event.model_scores ?? null) as ModelScores | null,
      feedback_removed: Boolean(event.feedback_removed),
    }));

    setEvents(rows);

    const userIds = Array.from(
      new Set(rows.map((event) => event.user_id).filter(Boolean) as string[])
    );

    const designIds = Array.from(
      new Set(rows.map((event) => event.design_id).filter(Boolean) as string[])
    );

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url,role")
        .in("id", userIds);

      const profileMap: Record<string, ProfileMini> = {};

      for (const profile of (profileData as ProfileMini[]) ?? []) {
        profileMap[profile.id] = profile;
      }

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    if (designIds.length > 0) {
      const { data: designData } = await supabase
        .from("designs")
        .select("id,title")
        .in("id", designIds);

      const designMap: Record<string, DesignMini> = {};

      for (const design of (designData as DesignMini[]) ?? []) {
        designMap[design.id] = design;
      }

      setDesigns(designMap);
    } else {
      setDesigns({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void checkModeratorRole();
  }, [checkModeratorRole]);

  useEffect(() => {
    if (checkingRole) return;
    if (!isModerator) return;

    void load();
  }, [checkingRole, isModerator, load]);

  async function markReviewed(eventId: string) {
    setMsg(null);
    setBusyId(eventId);

    const { error } = await supabase
      .from("moderation_events")
      .update({ reviewed: true })
      .eq("id", eventId);

    if (error) {
      setMsg("❌ Could not mark as reviewed: " + error.message);
      setBusyId(null);
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, reviewed: true } : event
      )
    );

    setMsg("✅ Marked as reviewed.");
    setBusyId(null);
  }

  async function markUnreviewed(eventId: string) {
    setMsg(null);
    setBusyId(eventId);

    const { error } = await supabase
      .from("moderation_events")
      .update({ reviewed: false })
      .eq("id", eventId);

    if (error) {
      setMsg("❌ Could not mark as unreviewed: " + error.message);
      setBusyId(null);
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, reviewed: false } : event
      )
    );

    setMsg("✅ Marked as unreviewed.");
    setBusyId(null);
  }

  async function findMatchingFeedback(event: ModerationEvent) {
    if (!event.design_id || !event.user_id) return null;

    const { data, error } = await supabase
      .from("feedback")
      .select("id,body,pros,cons,suggestions")
      .eq("design_id", event.design_id)
      .eq("user_id", event.user_id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const possibleFeedback = (data ?? []) as FeedbackSearchResult[];
    const original = normalizeText(event.original_text);

    if (!original) return possibleFeedback[0]?.id ?? null;

    const match = possibleFeedback.find((item) => {
      const body = normalizeText(item.body);
      const pros = normalizeText(item.pros);
      const cons = normalizeText(item.cons);
      const suggestions = normalizeText(item.suggestions);

      const combined = [body, pros, cons, suggestions]
        .filter(Boolean)
        .join(" ");

      return (
        combined.includes(original) ||
        original.includes(body) ||
        original.includes(pros) ||
        original.includes(cons) ||
        original.includes(suggestions)
      );
    });

    return match?.id ?? possibleFeedback[0]?.id ?? null;
  }

  async function removeFeedback(event: ModerationEvent) {
    setMsg(null);

    if (event.feedback_removed) {
      setMsg("This feedback has already been removed.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this feedback? This will delete it from the public design page and mark it as removed in the moderation dashboard."
    );

    if (!confirmed) return;

    setBusyId(event.id);

    let feedbackIdToDelete = event.feedback_id;

    if (!feedbackIdToDelete) {
      try {
        feedbackIdToDelete = await findMatchingFeedback(event);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown matching error";

        setMsg("❌ Could not search for matching feedback: " + message);
        setBusyId(null);
        return;
      }
    }

    if (!feedbackIdToDelete) {
      setMsg(
        "This moderation event is not linked to a posted feedback record, and no matching feedback could be found."
      );
      setBusyId(null);
      return;
    }

    const removedAt = new Date().toISOString();

    const { error: upvoteError } = await supabase
      .from("upvotes")
      .delete()
      .eq("feedback_id", feedbackIdToDelete);

    if (upvoteError) {
      setMsg("❌ Could not remove related upvotes: " + upvoteError.message);
      setBusyId(null);
      return;
    }

    const { error: feedbackError } = await supabase
      .from("feedback")
      .delete()
      .eq("id", feedbackIdToDelete);

    if (feedbackError) {
      setMsg("❌ Could not remove feedback: " + feedbackError.message);
      setBusyId(null);
      return;
    }

    const { error: eventError } = await supabase
      .from("moderation_events")
      .update({
        feedback_removed: true,
        feedback_removed_at: removedAt,
      })
      .eq("id", event.id);

    if (eventError) {
      setMsg(
        "❌ Feedback was deleted, but the dashboard could not save the removed label: " +
          eventError.message
      );
      setBusyId(null);
      return;
    }

    setEvents((prev) =>
      prev.map((item) =>
        item.id === event.id
          ? {
              ...item,
              feedback_removed: true,
              feedback_removed_at: removedAt,
            }
          : item
      )
    );

    setMsg("✅ Feedback removed. The moderation card is now labelled as removed.");
    setBusyId(null);
  }

  if (checkingRole) {
    return <p className="text-neutral-300">Checking moderator access…</p>;
  }

  if (!isModerator) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="glass-card glass p-5">
          <h1 className="text-2xl font-semibold">Moderator access required</h1>
          <p className="mt-2 text-sm text-neutral-400">
            You need a moderator account to view this page.
          </p>
        </div>

        <Link href="/designs" className="btn">
          ← Back to designs
        </Link>
      </div>
    );
  }

  const removedCount = events.filter((event) => event.feedback_removed).length;
  const unreviewedCount = events.filter((event) => !event.reviewed).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="chip w-fit">Moderator dashboard</p>

          <h1 className="hero-title text-4xl sm:text-5xl font-semibold">
            Review feedback.
          </h1>

          <p className="hero-subtitle max-w-2xl text-sm sm:text-base">
            Check NLP moderation results, review rule hits, and remove feedback
            that should not remain public.
          </p>
        </div>

        <button className="btn" type="button" onClick={() => void load()}>
          Refresh
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="glass-card glass p-4">
          <p className="text-xs text-neutral-500">Total events</p>
          <p className="mt-1 text-2xl font-semibold">{events.length}</p>
        </div>

        <div className="glass-card glass p-4">
          <p className="text-xs text-neutral-500">Unreviewed</p>
          <p className="mt-1 text-2xl font-semibold">{unreviewedCount}</p>
        </div>

        <div className="glass-card glass p-4 border border-red-500/30">
          <p className="text-xs text-red-300">Removed feedback</p>
          <p className="mt-1 text-2xl font-semibold text-red-200">
            {removedCount}
          </p>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button
          className={`btn gradient-outline-btn category-filter-btn ${
            filter === "UNREVIEWED" ? "is-active" : ""
          }`}
          type="button"
          onClick={() => setFilter("UNREVIEWED")}
        >
          Unreviewed
        </button>

        <button
          className={`btn gradient-outline-btn category-filter-btn ${
            filter === "ALL" ? "is-active" : ""
          }`}
          type="button"
          onClick={() => setFilter("ALL")}
        >
          All
        </button>
      </section>

      {msg && <p className="glass-card glass px-3 py-2 text-sm">{msg}</p>}

      {loading ? (
        <p className="text-neutral-300">Loading moderation events…</p>
      ) : shownEvents.length === 0 ? (
        <div className="glass-card glass p-5">
          <p className="text-sm text-neutral-400">
            No moderation events found for this filter.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {shownEvents.map((event) => {
            const profile = event.user_id ? profiles[event.user_id] : undefined;
            const design = event.design_id
              ? designs[event.design_id]
              : undefined;

            const rules = event.rule_hits ?? [];
            const scores = event.model_scores ?? null;
            const isBusy = busyId === event.id;
            const isRemoved = Boolean(event.feedback_removed);

            const canRemoveFeedback =
              !isRemoved &&
              event.action !== "BLOCK" &&
              Boolean(event.feedback_id || event.design_id);

            return (
              <article
                key={event.id}
                className={`glass-card glass p-5 space-y-4 ${
                  isRemoved ? "border border-red-500/40" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${actionClass(
                          event.action
                        )}`}
                      >
                        {actionLabel(event.action)}
                      </span>

                      {isRemoved && (
                        <span className="inline-flex rounded-full border border-red-500/50 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-200">
                          Feedback Removed
                        </span>
                      )}

                      <span className="chip">
                        {event.reviewed ? "Reviewed" : "Unreviewed"}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-500">
                      Submitted on {formatDate(event.created_at)}
                    </p>

                    {isRemoved && (
                      <p className="text-xs font-medium text-red-300">
                        Removed on {formatDate(event.feedback_removed_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {event.reviewed ? (
                      <button
                        className="btn"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void markUnreviewed(event.id)}
                      >
                        Mark unreviewed
                      </button>
                    ) : (
                      <button
                        className="btn"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void markReviewed(event.id)}
                      >
                        Mark reviewed
                      </button>
                    )}

                    <button
                      className={
                        isRemoved
                          ? "inline-flex items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 opacity-70"
                          : "btn"
                      }
                      type="button"
                      disabled={isBusy || !canRemoveFeedback}
                      onClick={() => void removeFeedback(event)}
                    >
                      {isBusy
                        ? "Working…"
                        : isRemoved
                          ? "Removed"
                          : "Remove feedback"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">User</p>
                    <p className="mt-1 text-sm font-semibold">
                      {userLabel(profile)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Design</p>

                    {event.design_id ? (
                      <Link
                        href={`/design/${event.design_id}`}
                        className="mt-1 block text-sm font-semibold hover:underline"
                      >
                        {design?.title ?? "Open design"}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold">
                        Unknown design
                      </p>
                    )}
                  </div>
                </div>

                <div className="glass rounded-2xl p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Feedback text analysed by NLP
                  </p>

                  <p
                    className={`whitespace-pre-wrap text-sm leading-6 ${
                      isRemoved ? "text-red-100" : "text-neutral-200"
                    }`}
                  >
                    {event.original_text || "No original text stored."}
                  </p>
                </div>

                {event.suggestion && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300">
                    <span className="font-semibold text-neutral-100">
                      Suggestion shown:
                    </span>{" "}
                    {event.suggestion}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Severity</p>
                    <p className="mt-1 text-lg font-semibold">
                      {scoreValue(scores?.severity_score)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Toxicity</p>
                    <p className="mt-1 text-lg font-semibold">
                      {scoreValue(scores?.toxicity_score)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Negativity</p>
                    <p className="mt-1 text-lg font-semibold">
                      {scoreValue(scores?.negativity_score)}
                    </p>
                  </div>

                  <div className="glass rounded-2xl p-3">
                    <p className="text-xs text-neutral-500">Style</p>
                    <p className="mt-1 text-lg font-semibold">
                      {scoreValue(scores?.style_score)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Rule hits
                  </p>

                  {rules.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {rules.map((rule) => (
                        <span key={rule} className="chip">
                          {rule}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No rule hits recorded.
                    </p>
                  )}
                </div>

                {scores?.engine && (
                  <p className="text-xs text-neutral-600">
                    Engine: {scores.engine}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}