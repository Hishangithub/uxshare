"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type DesignResult = {
  id: string;
  title: string;
  category: string | null;
  media_urls: string[] | null;
};

type UserResult = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export default function NavSearch() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [designs, setDesigns] = useState<DesignResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const cleanQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch(cleanQuery);
    }, 220);

    return () => clearTimeout(timer);
  }, [cleanQuery]);

  async function runSearch(value: string) {
    if (value.length < 2) {
      setDesigns([]);
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);

    const pattern = `%${value}%`;

    const [designResult, userResult] = await Promise.all([
      supabase
        .from("designs")
        .select("id,title,category,media_urls")
        .ilike("title", pattern)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("profiles")
        .select("id,username,full_name,avatar_url")
        .or(`username.ilike.${pattern},full_name.ilike.${pattern}`)
        .limit(5),
    ]);

    setDesigns((designResult.data as DesignResult[]) ?? []);
    setUsers((userResult.data as UserResult[]) ?? []);
    setLoading(false);
  }

  function closeSearch() {
    setOpen(false);
    setQuery("");
  }

  function userLabel(user: UserResult) {
    if (user.username) return `@${user.username}`;
    return user.full_name ?? "Unnamed user";
  }

  function userSubLabel(user: UserResult) {
    if (user.username && user.full_name) return user.full_name;
    return "User profile";
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  const hasResults = designs.length > 0 || users.length > 0;

  return (
    <div ref={wrapperRef} className="nav-search-shell">
      <input
        className="nav-search-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (cleanQuery.length >= 2) setOpen(true);
        }}
        placeholder="Search designs or users"
        aria-label="Search designs or users"
      />

      {open && cleanQuery.length >= 2 && (
        <div className="nav-search-dropdown">
          {loading ? (
            <p className="nav-search-empty">Searching…</p>
          ) : !hasResults ? (
            <p className="nav-search-empty">No results found.</p>
          ) : (
            <div className="space-y-1">
              {designs.length > 0 && (
                <div>
                  <p className="nav-search-section-title">Designs</p>

                  {designs.map((design) => {
                    const preview = design.media_urls?.[0] ?? null;

                    return (
                      <Link
                        key={design.id}
                        href={`/design/${design.id}`}
                        className="nav-search-item"
                        onClick={closeSearch}
                      >
                        {preview ? (
                          <img
                            src={preview}
                            alt={design.title}
                            className="nav-search-preview"
                          />
                        ) : (
                          <div className="nav-search-preview grid place-items-center text-[10px] font-bold">
                            UX
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {design.title}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {design.category === "PRODUCT" ? "Product" : "Web"}{" "}
                            design
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {users.length > 0 && (
                <div>
                  <p className="nav-search-section-title">Users</p>

                  {users.map((user) => {
                    const label = userLabel(user);

                    return (
                      <Link
                        key={user.id}
                        href={`/profile/${user.id}`}
                        className="nav-search-item"
                        onClick={closeSearch}
                      >
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={label}
                            className="nav-search-avatar"
                          />
                        ) : (
                          <div className="nav-search-avatar grid place-items-center text-[10px] font-bold">
                            {initials(label)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {label}
                          </p>
                          <p className="truncate text-xs text-neutral-500">
                            {userSubLabel(user)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}