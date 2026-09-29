'use client';

/** Bottom control dock: mic, camera, share, reactions, hand, people, chat, more, leave. */

import { useEffect, useRef, useState } from 'react';
import {
  MicIcon,
  MicOffIcon,
  CamIcon,
  CamOffIcon,
  ScreenIcon,
  ChatIcon,
  UsersIcon,
  HandIcon,
  SmileIcon,
  DotsIcon,
  PhoneDownIcon,
  CopyIcon,
  GridIcon,
  SpeakerViewIcon,
} from './icons';
import { IconButton } from './ui';

const REACTION_SET = ['👍', '❤️', '😂', '👏', '🎉', '😮', '🙏', '👋'];

interface BarProps {
  audioOn: boolean;
  videoOn: boolean;
  screenOn: boolean;
  handRaised: boolean;
  hasMedia: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
  onToggleHand: () => void;
  onSendReaction: (emoji: string) => void;
  peopleOpen: boolean;
  onTogglePeople: () => void;
  handCount: number;
  chatOpen: boolean;
  onToggleChat: () => void;
  unread: number;
  layout: 'grid' | 'speaker';
  onToggleLayout: () => void;
  isHost: boolean;
  onMuteAll: () => void;
  onLowerAllHands: () => void;
  onEndMeeting: () => void;
  onCopyInvite: () => void;
  onLeave: () => void;
}

function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return ref;
}

export default function ControlBar(p: BarProps) {
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // One dismiss ref for the whole dock: popups render outside the scrollable
  // pill (which must keep overflow-x for small screens) so they are never
  // clipped by it.
  const dockRef = useDismiss(() => {
    setReactionsOpen(false);
    setMoreOpen(false);
  });

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-4 sm:pb-6">
      <div ref={dockRef} className="pointer-events-auto relative max-w-full">
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-ink-900/90 px-2.5 py-2 shadow-dock backdrop-blur-md sm:gap-2 sm:px-3">
          <IconButton
            label={p.audioOn ? 'Mute microphone' : 'Unmute microphone'}
            onClick={p.onToggleAudio}
            active={!p.audioOn}
            disabled={!p.hasMedia}
          >
            {p.audioOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
          </IconButton>

          <IconButton
            label={p.videoOn ? 'Turn camera off' : 'Turn camera on'}
            onClick={p.onToggleVideo}
            active={!p.videoOn}
            disabled={!p.hasMedia}
          >
            {p.videoOn ? <CamIcon size={20} /> : <CamOffIcon size={20} />}
          </IconButton>

          <IconButton
            label={p.screenOn ? 'Stop sharing screen' : 'Share screen'}
            onClick={p.onToggleScreen}
            active={p.screenOn}
          >
            <ScreenIcon size={20} />
          </IconButton>

          <IconButton
            label="Send reaction"
            onClick={() => {
              setReactionsOpen((o) => !o);
              setMoreOpen(false);
            }}
            active={reactionsOpen}
          >
            <SmileIcon size={20} />
          </IconButton>

          <IconButton
            label={p.handRaised ? 'Lower hand' : 'Raise hand'}
            onClick={p.onToggleHand}
            active={p.handRaised}
          >
            <HandIcon size={20} />
          </IconButton>

          <IconButton
            label="Participants"
            onClick={p.onTogglePeople}
            active={p.peopleOpen}
            badge={p.handCount}
          >
            <UsersIcon size={20} />
          </IconButton>

          <IconButton
            label="Chat"
            onClick={p.onToggleChat}
            active={p.chatOpen}
            badge={p.unread}
          >
            <ChatIcon size={20} />
          </IconButton>

          <IconButton
            label="More options"
            onClick={() => {
              setMoreOpen((o) => !o);
              setReactionsOpen(false);
            }}
            active={moreOpen}
          >
            <DotsIcon size={20} />
          </IconButton>

          <div className="mx-1 h-8 w-px shrink-0 bg-white/10" />

          <IconButton label="Leave meeting" onClick={p.onLeave} danger>
            <PhoneDownIcon size={20} />
          </IconButton>
        </div>

        {/* Reactions popup — outside the scrollable pill so it can't be clipped */}
        {reactionsOpen && (
          <div className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-ink-850 p-2 shadow-pop animate-slide-up">
            {REACTION_SET.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`React ${e}`}
                onClick={() => {
                  p.onSendReaction(e);
                  setReactionsOpen(false);
                }}
                className="shrink-0 rounded-xl px-2 py-1.5 text-2xl transition-transform hover:scale-125 active:scale-110"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* More menu — outside the scrollable pill so it can't be clipped */}
        {moreOpen && (
          <div className="absolute bottom-[calc(100%+10px)] right-0 z-50 w-60 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-850 py-1.5 shadow-pop animate-slide-up">
            <MenuItem
              icon={<CopyIcon size={17} />}
              label="Copy invite link"
              onClick={() => {
                p.onCopyInvite();
                setMoreOpen(false);
              }}
            />
            <MenuItem
              icon={
                p.layout === 'grid' ? (
                  <SpeakerViewIcon size={17} />
                ) : (
                  <GridIcon size={17} />
                )
              }
              label={
                p.layout === 'grid' ? 'Switch to speaker view' : 'Switch to grid view'
              }
              onClick={() => {
                p.onToggleLayout();
                setMoreOpen(false);
              }}
            />
            {p.isHost && (
              <>
                <div className="my-1.5 h-px bg-white/[0.07]" />
                <MenuItem
                  icon={<HandIcon size={17} />}
                  label="Lower all hands"
                  onClick={() => {
                    p.onLowerAllHands();
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<MicOffIcon size={17} />}
                  label="Mute everyone"
                  onClick={() => {
                    p.onMuteAll();
                    setMoreOpen(false);
                  }}
                />
                <MenuItem
                  icon={<PhoneDownIcon size={17} />}
                  label="End meeting for all"
                  danger
                  onClick={() => {
                    setMoreOpen(false);
                    p.onEndMeeting();
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        danger
          ? 'text-brand hover:bg-brand-soft'
          : 'text-zinc-200 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}
