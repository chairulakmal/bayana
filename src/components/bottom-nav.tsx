"use client";

// BottomNav — fixed bottom tab bar for hub pages (home, stats, browse).
// Duolingo-style: three equal tabs with icons and labels.
// Active tab shown in grape; inactive in ink-faint.
// Not rendered on session screens (study, quiz, exam) — those own their full viewport.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Home", href: "/home", icon: HomeIcon },
  { label: "Stats", href: "/stats", icon: StatsIcon },
  { label: "Browse", href: "/browse", icon: BrowseIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
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
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5"
              style={{ color: active ? "var(--grape)" : "var(--ink-faint)" }}
            >
              <Icon active={active} />
              <span
                className="text-[10px]"
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
      width="22"
      height="22"
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
      width="22"
      height="22"
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
      width="22"
      height="22"
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
