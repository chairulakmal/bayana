"use client";

// BottomNav: fixed bottom tab bar for hub pages (home, grammar, stats, browse).
// Duolingo-style, three equal tabs with icons and labels.
// Active tab shown in grape; inactive in ink-faint.
// Not rendered on session screens (study, quiz, exam), which own their full viewport.

import Link from "next/link";
import { usePathname } from "next/navigation";

// The nav lists *places*, not study modes. Flashcards, Quiz, Exam, and Grammar are all
// reached from the home hub's mode grid; putting only Grammar in the tab bar mixed the two
// categories and made the omission of the other three look arbitrary. Grammar was in here
// because it was briefly the post-login landing itself (SPEC §16, 2026-07-02), which no
// longer holds now the hub surfaces grammar with a live due count.
//
// Home leads: it is the app's default page, so it is also the first tab.
//
// Known wart: `/grammar` is a place with no tab, so no tab highlights while you are on it.
// Accepted, and standard for a sub-page. The alternative (a fourth tab) is the thing this
// change is undoing.
const TABS = [
  { label: "Home", href: "/home", icon: HomeIcon },
  { label: "Stats", href: "/stats", icon: StatsIcon },
  { label: "Browse", href: "/browse", icon: BrowseIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      // The app's only <nav>, so this name is not disambiguating two landmarks: it is what a
      // screen reader's landmark list shows instead of a bare "navigation" entry. "Main", not
      // "Main navigation": the role is appended when announced, so the longer string stutters.
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "max(0px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              // Which tab you are on was carried by grape plus font-weight 700 alone, both of
              // which a screen reader cannot see, so the active tab announced identically to
              // the other two. Emitted only when active: `aria-current="false"` is valid but
              // pointless, since the attribute's absence is already what "not current" means.
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1.5 py-4"
              style={{ color: active ? "var(--grape)" : "var(--ink-faint)" }}
            >
              <Icon active={active} />
              <span
                className="text-[11px]"
                style={{
                  fontFamily: "var(--f-display)",
                  fontWeight: active ? 700 : 500,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Icons — stroke-based, 24 px grid, rounded caps/joins (Feather style)
// ---------------------------------------------------------------------------

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill={active ? "var(--grape)" : "none"}
      stroke={active ? "var(--grape)" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" stroke={active ? "#fff" : "currentColor"} />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--grape)" : "currentColor"}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="18" y1="20" x2="18" y2="10" />
    </svg>
  );
}

function BrowseIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--grape)" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}
