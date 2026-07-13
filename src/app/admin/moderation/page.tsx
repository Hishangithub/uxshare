"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OldModerationRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/moderate");
  }, [router]);

  return <p>Redirecting to Moderate…</p>;
}