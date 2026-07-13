"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
};

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function searchUsers(value = q) {
    setLoading(true);
    setErr(null);

    const term = value.trim();

    let query = supabase
      .from("profiles")
      .select("id,username,full_name,bio")
      .limit(30);

    if (term) {
      query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%`);
    }

    const { data, error } = await query.order("full_name", {
      ascending: true,
    });

    if (error) {
      setErr(error.message);
      setUsers([]);
    } else {
      setUsers((data as Profile[]) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    void searchUsers("");
  }, []);

  function displayName(u: Profile) {
    if (u.username) return `@${u.username}`;
    return u.full_name ?? "Anonymous";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Find users</h1>
        <p className="text-sm text-neutral-400">
          Search for users and view their posted designs.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void searchUsers();
        }}
      >
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search username or name"
        />

        <button className="btn" type="submit">
          Search
        </button>
      </form>

      {err && <p className="glass-card glass px-3 py-2 text-red-300">{err}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-neutral-400">No users found.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className="glass-card glass p-4">
              <Link href={`/profile/${u.id}`} className="block">
                <div className="font-semibold underline">{displayName(u)}</div>

                {u.full_name && u.username && (
                  <div className="text-sm text-neutral-400">{u.full_name}</div>
                )}

                <p className="text-sm text-neutral-300 mt-2 line-clamp-2">
                  {u.bio || "No bio added yet."}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}