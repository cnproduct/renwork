/** @jsxImportSource react */
import type { SVGProps } from "react";

export function RenWorkBrandMark({
  size = 24,
  className,
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="renOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#FF4500" />
        </linearGradient>
        <linearGradient id="renCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C8FF" />
          <stop offset="100%" stopColor="#0090FF" />
        </linearGradient>
        <filter id="renSoftShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Main Rocket A Body */}
      <path
        d="M 370 70 L 610 70 C 625 70 638 78 645 92 L 840 760 C 848 775 842 795 828 805 L 685 910 C 670 920 650 918 638 902 L 490 710 L 342 902 C 330 918 310 920 295 910 L 152 805 C 138 795 132 775 140 760 L 335 92 C 342 78 355 70 370 70 Z"
        fill="url(#renOrangeGrad)"
        filter="url(#renSoftShadow)"
      />

      {/* Outer White Ring */}
      <circle cx="490" cy="350" r="115" fill="#FFFFFF" />

      {/* Inner Cyan Pupil / Core */}
      <circle cx="490" cy="350" r="75" fill="url(#renCyanGrad)" />

      {/* Top-Right Sparkle Star */}
      <path
        d="M 780 130 Q 780 230 880 230 Q 780 230 780 330 Q 780 230 680 230 Q 780 230 780 130 Z"
        fill="url(#renCyanGrad)"
      />
    </svg>
  );
}
