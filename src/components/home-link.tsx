// HomeLink — compact "back to hub" navigation used on secondary pages (Stats, Browse).
//
// Pairs with the home hub's おかえり greeting: home says "welcome back" (おかえり),
// and this link replies "I'm home" (ただいま) — the natural call-and-response that every
// Japanese speaker knows as a set.

import Link from "next/link";
import { Parrot } from "@/components/parrot";

export function HomeLink() {
  return (
    <Link
      href="/home"
      className="inline-flex items-center gap-1.5 active:opacity-70"
      style={{
        fontFamily: "var(--f-display)",
        fontWeight: 600,
        fontSize: 13,
        padding: "4px 10px 4px 5px",
        borderRadius: 999,
        background: "var(--surface)",
        boxShadow: "inset 0 0 0 1.5px var(--pink-200), 0 2px 0 var(--line)",
        color: "var(--grape)",
      }}
    >
      <Parrot expr="wink" style={{ width: 20, height: 22 }} />
      <span aria-hidden style={{ color: "var(--ink-faint)" }}>←</span>
      <span className="jp">ただいま</span>
    </Link>
  );
}
