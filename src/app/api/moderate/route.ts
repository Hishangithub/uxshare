import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ModerationAction = "ALLOW" | "NUDGE" | "BLOCK";

type AnalysisResult = {
  action: ModerationAction;
  rule_hits: string[];
  suggestion: string | null;
  severity_score: number;
  model_scores: {
    engine: string;
    severity_score: number;
    toxicity_score: number;
    negativity_score: number;
    style_score: number;
    features: {
      strong_profanity_hits: string[];
      abusive_phrase_hits: string[];
      insulting_language_hits: string[];
      impolite_hits: string[];
      negative_hits: string[];
      caps_ratio: number;
      repeated_punctuation: boolean;
      word_count: number;
    };
  };
};

/*
  Basic NLP moderation pipeline:
  1. Clean and normalise feedback text.
  2. Tokenize the comment into words.
  3. Detect profanity, insults, abusive phrases, and negative wording.
  4. Detect aggressive writing style such as all caps or repeated punctuation.
  5. Calculate a severity score.
  6. Decide whether to allow, warn/nudge, or block.
  7. Save the moderation result for moderator review.
*/

const STRONG_PROFANITY = [
  "fuck",
  "fucking",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "cunt",
];

const ABUSIVE_PHRASES = [
  "kill yourself",
  "go die",
  "you are worthless",
  "nobody likes you",
  "you should disappear",
];

const INSULTING_LANGUAGE = [
  "idiot",
  "moron",
  "loser",
  "clown",
];

const IMPOLITE_WORDS = [
  "trash",
  "stupid",
  "dumb",
  "ugly",
  "useless",
  "pathetic",
];

const NEGATIVE_WORDS = [
  "bad",
  "terrible",
  "awful",
  "horrible",
  "confusing",
  "messy",
  "boring",
  "weak",
  "poor",
  "broken",
  "unclear",
];

function cleanText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\w\s!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  if (!text.trim()) return [];
  return text.split(/\s+/).filter(Boolean);
}

function findWordHits(words: string[], list: string[]) {
  return list.filter((item) => words.includes(item));
}

function findPhraseHits(cleanedText: string, phrases: string[]) {
  return phrases.filter((phrase) => cleanedText.includes(phrase));
}

function getCapsRatio(originalText: string) {
  const lettersOnly = originalText.replace(/[^a-zA-Z]/g, "");

  if (lettersOnly.length < 8) return 0;

  const uppercaseOnly = lettersOnly.replace(/[^A-Z]/g, "");

  return uppercaseOnly.length / lettersOnly.length;
}

function hasRepeatedPunctuation(originalText: string) {
  return /[!?]{3,}/.test(originalText);
}

function analyseText(originalText: string): AnalysisResult {
  const cleanedText = cleanText(originalText);
  const words = tokenize(cleanedText);

  const strongProfanityHits = findWordHits(words, STRONG_PROFANITY);
  const abusivePhraseHits = findPhraseHits(cleanedText, ABUSIVE_PHRASES);
  const insultingLanguageHits = findWordHits(words, INSULTING_LANGUAGE);
  const impoliteHits = findWordHits(words, IMPOLITE_WORDS);
  const negativeHits = findWordHits(words, NEGATIVE_WORDS);

  const capsRatio = getCapsRatio(originalText);
  const repeatedPunctuation = hasRepeatedPunctuation(originalText);

  const ruleHits: string[] = [];

  let toxicityScore = 0;
  let negativityScore = 0;
  let styleScore = 0;

  if (strongProfanityHits.length > 0) {
    ruleHits.push("STRONG_PROFANITY");
    toxicityScore += 75 + Math.min(15, strongProfanityHits.length * 5);
  }

  if (abusivePhraseHits.length > 0) {
    ruleHits.push("ABUSIVE_PHRASE");
    toxicityScore += 85;
  }

  if (insultingLanguageHits.length > 0) {
    ruleHits.push("INSULTING_LANGUAGE");
    toxicityScore += 35 + Math.min(20, insultingLanguageHits.length * 6);
  }

  if (impoliteHits.length > 0) {
    ruleHits.push("IMPOLITE_LANGUAGE");
    toxicityScore += 30 + Math.min(20, impoliteHits.length * 6);
  }

  if (negativeHits.length >= 2) {
    ruleHits.push("NEGATIVE_FEEDBACK_STYLE");
    negativityScore += 18 + Math.min(12, negativeHits.length * 3);
  } else if (negativeHits.length === 1) {
    negativityScore += 8;
  }

  if (capsRatio > 0.65) {
    ruleHits.push("AGGRESSIVE_CAPS");
    styleScore += 10;
  }

  if (repeatedPunctuation) {
    ruleHits.push("REPEATED_PUNCTUATION");
    styleScore += 6;
  }

  const severityScore = Math.min(
    100,
    Math.round(toxicityScore + negativityScore + styleScore)
  );

  let action: ModerationAction = "ALLOW";
  let suggestion: string | null = null;

  if (
    strongProfanityHits.length > 0 ||
    abusivePhraseHits.length > 0 ||
    severityScore >= 70
  ) {
    action = "BLOCK";
    suggestion =
      "Your feedback was blocked because it contains inappropriate or abusive language. Please keep your feedback respectful and professional.";
  } else if (severityScore >= 25) {
    action = "NUDGE";
    suggestion =
      "Try focusing on what can be improved instead of using harsh or insulting words.";
  }

  return {
    action,
    rule_hits: ruleHits,
    suggestion,
    severity_score: severityScore,
    model_scores: {
      engine: "basic_rule_based_nlp_v1",
      severity_score: severityScore,
      toxicity_score: Math.min(100, Math.round(toxicityScore)),
      negativity_score: Math.min(100, Math.round(negativityScore)),
      style_score: Math.min(100, Math.round(styleScore)),
      features: {
        strong_profanity_hits: strongProfanityHits,
        abusive_phrase_hits: abusivePhraseHits,
        insulting_language_hits: insultingLanguageHits,
        impolite_hits: impoliteHits,
        negative_hits: negativeHits,
        caps_ratio: Number(capsRatio.toFixed(2)),
        repeated_punctuation: repeatedPunctuation,
        word_count: words.length,
      },
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const text: string = body?.text ?? "";
    const designId: string | null = body?.designId ?? null;
    const userId: string | null = body?.userId ?? null;

    const result = analyseText(text);

    const { data, error } = await supabaseAdmin
      .from("moderation_events")
      .insert([
        {
          target_type: "FEEDBACK",
          target_id: designId,
          design_id: designId,
          feedback_id: null,
          user_id: userId,
          rule_hits: result.rule_hits,
          model_scores: result.model_scores,
          action: result.action,
          suggestion: result.suggestion,
          original_text: text,
          reviewed: false,
        },
      ])
      .select("id")
      .single();

    return NextResponse.json({
      action: result.action,
      rule_hits: result.rule_hits,
      suggestion: result.suggestion,
      severity_score: result.severity_score,
      model_scores: result.model_scores,
      event_id: data?.id ?? null,
      db_error: error?.message ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        action: "ALLOW",
        rule_hits: [],
        suggestion: null,
        severity_score: 0,
        model_scores: null,
        event_id: null,
        db_error: e?.message ?? "unexpected",
      },
      { status: 200 }
    );
  }
}