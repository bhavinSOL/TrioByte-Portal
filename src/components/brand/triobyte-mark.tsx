import type { SVGProps } from "react";

export function TrioByteMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="2" y="2" width="36" height="36" rx="9" fill="currentColor" opacity="0.12" />
      <path d="M11 13h18M16 13v15M24 19h5M24 25h5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}
