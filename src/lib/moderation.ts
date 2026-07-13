import { supabase } from "@/lib/supabaseClient";

export async function listModeration(filter: "All" | "Nudges" | "Blocks") {
  let q = supabase
    .from("moderation_events")
    .select("id, action, rule_hits, suggestion, created_at, reviewed, user_id, design_id:target_id, feedback_id, target_type")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter === "Nudges") q = q.eq("action", "NUDGE");
  if (filter === "Blocks") q = q.eq("action", "BLOCK");
  return await q;
}

export async function markReviewed(eventId: string) {
  return await supabase.from("moderation_events").update({ reviewed: true }).eq("id", eventId);
}

export async function removeFeedback(feedbackId: string, eventId: string) {
  const del = await supabase.from("feedback").delete().eq("id", feedbackId);
  if (del.error) return del;
  return await supabase.from("moderation_events").update({ action: "REMOVED", reviewed: true }).eq("id", eventId);
}
