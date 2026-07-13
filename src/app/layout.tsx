import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ModerateLink from "@/components/ModerateLink";
import AuthMenu from "@/components/AuthMenu";
import NavSearch from "@/components/NavSearch";

export const metadata: Metadata = {
  title: "UXShare",
  description: "Collaborative UI/UX feedback platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        <div className="fixed inset-0 -z-10 bg-blue-canvas" />

        <header className="sticky top-4 z-40 mx-auto max-w-6xl px-4">
          <div className="nav-shell rounded-full px-4 py-3">
            <div className="ux-navbar">
              <Link href="/designs" className="ux-brand group">
                <div className="ux-logo-image-wrap">
                  <img src="/UX.png" alt="UXShare logo" className="ux-logo-image" />
                </div>

                <div className="leading-tight">
                  <span className="block font-semibold tracking-tight">
                    UXShare
                  </span>
                  <span className="hidden sm:block text-[11px] text-neutral-400">
                    Feedback for better interfaces
                  </span>
                </div>
              </Link>

              <div className="ux-search-center">
                <NavSearch />
              </div>

              <nav className="ux-nav-actions text-sm">
                <Link href="/designs" className="nav-link">
                  Designs
                </Link>

                <ModerateLink />

                <AuthMenu />
              </nav>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-10 pb-12">
          {children}
        </main>

        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-neutral-500">
          <div className="glass-card glass px-5 py-4 flex items-center justify-between gap-3">
            <span>© UXShare</span>
            <span className="hidden sm:inline">
              Collaborative UI/UX feedback platform
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}