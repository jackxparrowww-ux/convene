'use client';

/** A single participant tile: video (or avatar fallback), status badges, pin, reactions. */

import { useCallback } from 'react';
import { MicOffIcon, HandIcon, PinIcon } from './icons';
import { Avatar } from './ui';
import type { ReactionBurst } from '@/hooks/useMeeting';

interface TileProps {
  stream: MediaStream | null;
  name: string;
  muted: boolean;
  videoOff: boolean;
  handRaised: boolean;
  speaking: boolean;
  pinned: boolean;
  isSelf?: boolean;
  isScreen?: boolean;
  isHost?: boolean;
  mirror?: boolean;
  reactions: ReactionBurst[];
  onTogglePin: () => void;
  /** Fill the parent container instead of keeping a fixed 16:9 box. */
  fill?: boolean;
}

export default function VideoTile({
  stream,
  name,
  muted,
  videoOff,
  handRaised,
  speaking,
  pinned,
  isSelf = false,
  isScreen = false,
  isHost = false,
  mirror = false,
  reactions,
  onTogglePin,
  fill = false,
}: TileProps) {
  // Callback ref: (re)attaches the stream whenever the element mounts —
  // including remounts from camera toggles — and when the stream changes.
  const attach = useCallback(
    (el: HTMLVideoElement | HTMLAudioElement | null) => {
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().catch(() => undefined);
      }
    },
    [stream]
  );

  const showVideo = !!stream && !videoOff && !isScreen ? true : !!stream && isScreen;

  return (
    <div
      onDoubleClick={onTogglePin}
      className={`group relative select-none overflow-hidden rounded-xl bg-ink-800 transition-shadow duration-200 ${
        fill ? 'h-full w-full' : 'aspect-video w-full'
      } ${        speaking
          ? 'ring-2 ring-brand shadow-[0_0_24px_rgba(225,29,72,0.25)]'
          : pinned
            ? 'ring-2 ring-white/30'
            : 'ring-1 ring-white/[0.06]'
      }`}
      title={isScreen ? `${name} — screen share` : name}
    >
      {showVideo ? (
        <video
          ref={attach}
          autoPlay
          playsInline
          muted
          className={`h-full w-full ${isScreen ? 'object-contain bg-black' : `object-cover ${mirror ? 'mirror' : ''}`}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Avatar name={name} size={56} />
        </div>
      )}
      {/* Remote audio: the <video> above is muted (autoplay policy), so a
          dedicated audio element carries the remote participant's voice.
          Self tiles never render this (echo). */}
      {!isSelf && stream && (
        <audio ref={attach} autoPlay className="hidden" />
      )}

      {/* status badges, top-left */}
      <div className="absolute left-2 top-2 flex gap-1.5">
        {handRaised && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white" title="Hand raised">
            <HandIcon size={14} />
          </span>
        )}
        {muted && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-zinc-300" title="Muted">
            <MicOffIcon size={14} />
          </span>
        )}
      </div>

      {/* pin toggle, top-right (hover) */}
      {!isScreen && (
        <button
          type="button"
          onClick={onTogglePin}
          aria-label={pinned ? `Unpin ${name}` : `Pin ${name}`}
          title={pinned ? 'Unpin' : 'Pin'}
          className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 transition-all ${
            pinned
              ? 'text-brand opacity-100'
              : 'text-zinc-300 opacity-0 group-hover:opacity-100 focus:opacity-100'
          } hover:text-white`}
        >
          <PinIcon size={14} />
        </button>
      )}

      {/* name label, bottom-left */}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5">
        <span className="truncate rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-zinc-200">
          {name}
          {isSelf && <span className="text-zinc-400"> (you)</span>}
          {isScreen && <span className="text-zinc-400"> — screen</span>}
        </span>
        {isHost && (
          <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand ring-1 ring-brand/40">
            Host
          </span>
        )}
      </div>

      {/* floating reactions anchored to this tile */}
      <div className="reaction-layer absolute inset-0 overflow-hidden">
        {reactions.map((r) => {
          let h = 0;
          for (let i = 0; i < r.id.length; i++)
            h = (h * 31 + r.id.charCodeAt(i)) >>> 0;
          return (
            <span
              key={r.id}
              className="absolute bottom-8 animate-float-up text-[28px] drop-shadow-lg"
              style={{ left: `${28 + (h % 44)}%` }}
            >
              {r.emoji}
            </span>
          );
        })}
      </div>
    </div>
  );
}
