import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { id, reviewed } = await req.json().catch(() => ({ id: null, reviewed: null }));
  if (!id || typeof reviewed !== "boolean") return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("moderation_events").update({ reviewed }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  return NextResponse.json({ ok: true });
}
