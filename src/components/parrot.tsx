// Pī — the Bayana mascot, as a reusable SVG component (BRAND.md §2).
//
// Ported faithfully from notes/bayana/bayana-brand/brand.js. Each expression is the SAME
// silhouette with only the eyes + beak swapped, so the whole cast reads as one bird. Use
// the named expressions (happy/wow/wink/sleepy) at the moments BRAND.md prescribes —
// don't invent new poses. Renders as inline SVG (a server component; no client JS).
import type { CSSProperties } from "react";

export type PiExpression = "happy" | "wow" | "wink" | "sleepy";

// Palette pulled from the mascot source, kept local so the bird is self-contained.
const C = {
  mag: "#ff61f8",
  pink: "#ffa6fb",
  yel: "#ffea6c",
  cream: "#fffba7",
  pinkL: "#ffc6ff",
  ink: "#341832",
  beakLo: "#f4cf45",
} as const;

function Eyes({ expr }: { expr: PiExpression }) {
  if (expr === "wink") {
    return (
      <>
        <circle cx="142" cy="116" r="23" fill="#fff" />
        <circle cx="138" cy="120" r="12" fill={C.ink} />
        <circle cx="142" cy="114" r="4.6" fill="#fff" />
        <path d="M80 117 Q98 104 116 117" fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      </>
    );
  }
  if (expr === "sleepy") {
    return (
      <>
        <path d="M79 116 Q98 127 117 116" fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
        <path d="M123 116 Q142 127 161 116" fill="none" stroke={C.ink} strokeWidth="7" strokeLinecap="round" />
      </>
    );
  }
  // happy + wow share open eyes; wow adds sparkles.
  return (
    <>
      <circle cx="98" cy="116" r="23" fill="#fff" />
      <circle cx="142" cy="116" r="23" fill="#fff" />
      <circle cx="103" cy="120" r="12" fill={C.ink} />
      <circle cx="137" cy="120" r="12" fill={C.ink} />
      <circle cx="107" cy="115" r="4.6" fill="#fff" />
      <circle cx="141" cy="115" r="4.6" fill="#fff" />
      {expr === "wow" && (
        <>
          <path d="M58 96 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill={C.yel} />
          <path d="M182 96 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 z" fill={C.yel} />
        </>
      )}
    </>
  );
}

function Beak({ expr }: { expr: PiExpression }) {
  if (expr === "wow") {
    return (
      <>
        <path d="M104 135 Q120 129 136 135 Q138 145 120 147 Q102 145 104 135 Z" fill={C.yel} />
        <ellipse cx="120" cy="150" rx="11" ry="6" fill={C.ink} />
        <path d="M108 151 Q120 147 132 151 Q128 166 120 167 Q112 166 108 151 Z" fill={C.beakLo} />
      </>
    );
  }
  return (
    <>
      <path d="M104 138 Q120 132 136 138 Q139 154 120 166 Q101 154 104 138 Z" fill={C.yel} />
      <path d="M109 150 Q120 156 131 150 Q125 165 120 166 Q115 165 109 150 Z" fill={C.beakLo} />
    </>
  );
}

/**
 * Pī, full body. Size via `className`/`style` (the SVG scales to its box; native
 * aspect ratio is 240×268).
 */
export function Parrot({
  expr = "happy",
  className,
  style,
  title,
}: {
  expr?: PiExpression;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 240 268"
      role="img"
      aria-label={title ?? `Pī the parrot, ${expr}`}
    >
      {/* tail */}
      <ellipse cx="120" cy="222" rx="13" ry="34" fill={C.yel} />
      <ellipse cx="96" cy="216" rx="11" ry="30" fill={C.pink} transform="rotate(-24 96 216)" />
      <ellipse cx="144" cy="216" rx="11" ry="30" fill={C.cream} transform="rotate(24 144 216)" />
      {/* feet */}
      <g fill={C.beakLo}>
        <rect x="97" y="196" width="10" height="22" rx="5" />
        <rect x="133" y="196" width="10" height="22" rx="5" />
        <circle cx="102" cy="217" r="6" />
        <circle cx="138" cy="217" r="6" />
      </g>
      {/* crest */}
      <ellipse cx="120" cy="40" rx="10" ry="25" fill={C.yel} />
      <ellipse cx="98" cy="51" rx="9" ry="21" fill={C.pink} transform="rotate(-26 98 51)" />
      <ellipse cx="142" cy="51" rx="9" ry="21" fill={C.cream} transform="rotate(26 142 51)" />
      {/* body */}
      <rect x="52" y="62" width="136" height="152" rx="66" fill={C.mag} />
      {/* belly */}
      <ellipse cx="120" cy="158" rx="50" ry="52" fill={C.pink} />
      {/* wings */}
      <ellipse cx="61" cy="150" rx="17" ry="41" fill={C.cream} transform="rotate(10 61 150)" />
      <ellipse cx="179" cy="150" rx="17" ry="41" fill={C.cream} transform="rotate(-10 179 150)" />
      {/* cheeks */}
      <circle cx="84" cy="150" r="11" fill={C.pinkL} opacity="0.9" />
      <circle cx="156" cy="150" r="11" fill={C.pinkL} opacity="0.9" />
      <Eyes expr={expr} />
      <Beak expr={expr} />
    </svg>
  );
}
