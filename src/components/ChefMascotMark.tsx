import * as React from "react";
import { cn } from "@/lib/cn";

export function ChefMascotMark({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("h-10 w-10", className)}
    >
      <defs>
        <linearGradient id="ddb_hat" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#f2efe8" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="ddb_blush" x1="0" x2="1">
          <stop offset="0" stopColor="#f6d7de" />
          <stop offset="1" stopColor="#fde7a0" />
        </linearGradient>
      </defs>

      {/* soft badge */}
      <circle cx="32" cy="32" r="30" fill="url(#ddb_blush)" opacity="0.35" />
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
      />

      {/* hat */}
      <path
        d="M20 22c0-5 4.8-9 12-9s12 4 12 9c3.5.6 6 3.1 6 6.3 0 3.9-3.5 7-8 7H22c-4.5 0-8-3.1-8-7 0-3.2 2.5-5.7 6-6.3Z"
        fill="url(#ddb_hat)"
        stroke="rgba(28,27,24,0.14)"
        strokeWidth="1"
      />
      <path
        d="M22 35h20"
        stroke="rgba(28,27,24,0.18)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* face */}
      <path
        d="M20 36c2.8-2.7 7.1-4.6 12-4.6S41.2 33.3 44 36v7.3c0 8-5.4 14.7-12 14.7S20 51.3 20 43.3V36Z"
        fill="#fff"
        opacity="0.92"
        stroke="rgba(28,27,24,0.14)"
        strokeWidth="1"
      />
      {/* eyes */}
      <circle cx="27.5" cy="43" r="1.6" fill="rgba(28,27,24,0.72)" />
      <circle cx="36.5" cy="43" r="1.6" fill="rgba(28,27,24,0.72)" />
      {/* smile */}
      <path
        d="M28 48c1.4 1.6 3 2.4 4 2.4s2.6-.8 4-2.4"
        stroke="rgba(28,27,24,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* cheeks */}
      <circle cx="24.5" cy="46.5" r="2.2" fill="#f6d7de" opacity="0.7" />
      <circle cx="39.5" cy="46.5" r="2.2" fill="#f6d7de" opacity="0.7" />
    </svg>
  );
}

