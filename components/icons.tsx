/**
 * Convene custom SVG icon set.
 * Stroke-based, 24px grid, currentColor — never emoji-as-icons.
 */

import React from 'react';

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

function base({
  size = 20,
  className,
  strokeWidth = 1.8,
  children,
  filled = false,
}: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const LogoMark = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="#e11d48" />
    {/* Stylized "C" formed by two conversation arcs */}
    <path
      d="M27.5 14.5a8 8 0 1 0 0 11"
      fill="none"
      stroke="#fff"
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <circle cx="27.5" cy="20" r="2.6" fill="#fff" />
  </svg>
);

export const MicIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 18v3.5" />
      </>
    ),
  });

export const MicOffIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="9" y="2.5" width="6" height="11" rx="3" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
        <path d="M12 18v3.5" />
        <path d="M3.5 3.5l17 17" />
      </>
    ),
  });

export const CamIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
        <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
      </>
    ),
  });

export const CamOffIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="6.5" width="13" height="11" rx="2.5" />
        <path d="M15.5 10.5l6-3.5v10l-6-3.5" />
        <path d="M3.5 3.5l17 17" />
      </>
    ),
  });

export const ScreenIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="4.5" width="19" height="12.5" rx="2" />
        <path d="M12 8v5" />
        <path d="M9.5 10.5L12 8l2.5 2.5" />
        <path d="M9 20.5h6" />
      </>
    ),
  });

export const ChatIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12z" />
        <path d="M8.5 11h.01M12 11h.01M15.5 11h.01" strokeWidth={2.4} />
      </>
    ),
  });

export const UsersIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3.2 3.2 0 0 1 0 5.7" />
        <path d="M17.8 14.3a5.5 5.5 0 0 1 2.7 5.2" />
      </>
    ),
  });

export const HandIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M8 12.5V6a1.4 1.4 0 0 1 2.8 0v5V4.8a1.4 1.4 0 0 1 2.8 0V11v-5a1.4 1.4 0 0 1 2.8 0v6.5" />
        <path d="M8 12.5l-1.9-2.1a1.3 1.3 0 0 0-2 1.6l3.6 5.2A6 6 0 0 0 12.6 20h1.2a6 6 0 0 0 6-6v-2.5a1.4 1.4 0 0 0-2.8 0" />
      </>
    ),
  });

export const SmileIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 14.5a4.5 4.5 0 0 0 6 0" />
        <path d="M9 9.5h.01M15 9.5h.01" strokeWidth={2.6} />
      </>
    ),
  });

export const DotsIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="5.5" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="18.5" cy="12" r="1.4" />
      </>
    ),
  });

export const PhoneDownIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <g transform="rotate(135 12 12)">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      </g>
    ),
  });

export const CopyIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="9" y="9" width="12" height="12" rx="2.5" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
  });

export const LinkIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.7 1.7" />
        <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.7-1.7" />
      </>
    ),
  });

export const CheckIcon = (p: IconProps) =>
  base({
    ...p,
    children: <path d="M4.5 12.5l5 5 10-11" />,
  });

export const XIcon = (p: IconProps) =>
  base({
    ...p,
    children: <path d="M6 6l12 12M18 6L6 18" />,
  });

export const PinIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M9 4h6l1 6 3 3v2H5v-2l3-3 1-6z" />
        <path d="M12 15v6" />
      </>
    ),
  });

export const ChevronDownIcon = (p: IconProps) =>
  base({ ...p, children: <path d="M6 9.5l6 6 6-6" /> });

export const GridIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
  });

export const SpeakerViewIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="3" y="4.5" width="13" height="15" rx="2" />
        <rect x="18" y="4.5" width="3.5" height="4.5" rx="1.2" />
        <rect x="18" y="11" width="3.5" height="4.5" rx="1.2" />
        <rect x="18" y="17.5" width="3.5" height="2" rx="1" />
      </>
    ),
  });

export const SendIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M21 3.5L10.5 14" />
        <path d="M21 3.5l-6.8 17-3.7-6.5L3.5 10.3 21 3.5z" />
      </>
    ),
  });

export const ClockIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  });

export const ShieldIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M12 3l7.5 3v5.5c0 4.8-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.7-7.5-9.5V6L12 3z" />
        <path d="M9.5 12l2 2 3.5-4" />
      </>
    ),
  });

export const ZapIcon = (p: IconProps) =>
  base({
    ...p,
    children: <path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z" />,
  });

export const SearchIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
      </>
    ),
  });

export const AlertIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M12 3.5L22 20H2L12 3.5z" />
        <path d="M12 10v4" />
        <path d="M12 17.5h.01" strokeWidth={2.6} />
      </>
    ),
  });

export const RefreshIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M20 11a8 8 0 1 0-2.3 6.3" />
        <path d="M20 5v6h-6" />
      </>
    ),
  });

export const SpeakerIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
        <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
      </>
    ),
  });

export const CaptionsIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
        <path d="M10 10.5H7.5a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2H10" />
        <path d="M18.5 10.5H16a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h2.5" />
      </>
    ),
  });

export const RecordIcon = (p: IconProps & { recording?: boolean }) => (
  <svg
    width={p.size || 20}
    height={p.size || 20}
    viewBox="0 0 24 24"
    fill="none"
    className={p.className}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={p.strokeWidth || 1.8} />
    <circle
      cx="12"
      cy="12"
      r={p.recording ? "4.5" : "5"}
      fill={p.recording ? "#ef4444" : "currentColor"}
      className={p.recording ? "animate-pulse" : ""}
    />
  </svg>
);

export const SettingsIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  });

export const NotesIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </>
    ),
  });

export const PipIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <rect x="12" y="11" width="7" height="6" rx="1.5" fill="currentColor" opacity="0.3" />
        <rect x="12" y="11" width="7" height="6" rx="1.5" />
      </>
    ),
  });

export const KeyboardIcon = (p: IconProps) =>
  base({
    ...p,
    children: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
        <path d="M7 10h.01M10 10h.01M14 10h.01M17 10h.01M6 14h12" />
      </>
    ),
  });
