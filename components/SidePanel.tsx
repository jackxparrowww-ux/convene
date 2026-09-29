'use client';

/** Right-side dock (desktop) / bottom sheet (mobile) with Participants and Chat tabs. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MicOffIcon,
  HandIcon,
  SendIcon,
  SearchIcon,
  XIcon,
} from './icons';
import { Avatar, CloseButton, initialsOf } from './ui';
import type {
  MeetingApi,
  RemoteParticipant,
} from '@/hooks/useMeeting';

interface PanelProps {
  api: MeetingApi;
  selfName: string;
  tab: 'people' | 'chat';
  setTab: (t: 'people' | 'chat') => void;
  onClose: () => void;
  onConfirmRemove: (id: string, name: string) => void;
  onConfirmMuteAll: () => void;
}

export default function SidePanel({
  api,
  selfName,
  tab,
  setTab,
  onClose,
  onConfirmRemove,
  onConfirmMuteAll,
}: PanelProps) {
  useEffect(() => {
    if (tab === 'chat') api.markChatRead();
  }, [tab, api]);

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden border-white/10 bg-ink-900/95 shadow-pop backdrop-blur-md animate-slide-up
        inset-x-0 bottom-0 top-[12%] rounded-t-3xl border-t
        md:inset-x-auto md:bottom-24 md:right-4 md:top-20 md:w-[340px] md:rounded-2xl md:border"
      role="complementary"
      aria-label={tab === 'people' ? 'Participants' : 'Meeting chat'}
    >
      {/* grab handle (mobile) */}
      <div className="flex justify-center pt-2.5 md:hidden" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-white/20" />
      </div>
      {/* tabs */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 pb-0 pt-1">
        <div className="flex gap-1">
          <TabButton
            active={tab === 'people'}
            onClick={() => setTab('people')}
            label={`Participants (${Object.keys(api.remotes).length + 1})`}
          />
          <TabButton
            active={tab === 'chat'}
            onClick={() => setTab('chat')}
            label="Chat"
            badge={api.unread}
          />
        </div>
        <CloseButton onClick={onClose} label="Close panel" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'people' ? (
          <ParticipantsTab
            api={api}
            selfName={selfName}
            onConfirmRemove={onConfirmRemove}
            onConfirmMuteAll={onConfirmMuteAll}
          />
        ) : (
          <ChatTab api={api} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 pb-3 pt-2 text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
      )}
    </button>
  );
}

/* ---------------- Participants ---------------- */

function ParticipantsTab({
  api,
  selfName,
  onConfirmRemove,
  onConfirmMuteAll,
}: {
  api: MeetingApi;
  selfName: string;
  onConfirmRemove: (id: string, name: string) => void;
  onConfirmMuteAll: () => void;
}) {
  const [query, setQuery] = useState('');

  const ordered = useMemo(() => {
    const list = Object.values(api.remotes);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter((p) => p.name.toLowerCase().includes(q))
      : list;
    // Raised hands first (in raise order), then by join time.
    return filtered.sort((a, b) => {
      if (a.hand !== b.hand) return a.hand ? -1 : 1;
      if (a.hand && b.hand) return a.handRaisedAt - b.handRaisedAt;
      return a.joinedAt - b.joinedAt;
    });
  }, [api.remotes, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-2 pt-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-ink-850 px-3 py-2">
          <SearchIcon size={16} className="shrink-0 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search participants"
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-white"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* self row */}
        <ParticipantRow
          name={selfName}
          you
          isHost={api.isHost}
          audio={api.audioOn}
          video={api.videoOn}
          hand={api.handRaised}
        />
        {ordered.map((p) => (
          <ParticipantRow
            key={p.id}
            name={p.name}
            isHost={api.hostId === p.id}
            audio={p.audio}
            video={p.video}
            hand={p.hand}
            hostControls={
              api.isHost ? (
                <HostRowControls
                  participant={p}
                  onMute={() => api.muteParticipant(p.id)}
                  onLowerHand={() => api.lowerHand(p.id)}
                  onRemove={() => onConfirmRemove(p.id, p.name)}
                />
              ) : undefined
            }
          />
        ))}
        {ordered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            {query ? 'No participants match your search.' : 'Nobody else is here yet.'}
          </p>
        )}
      </div>

      {api.isHost && (
        <div className="border-t border-white/[0.07] p-3">
          <button
            type="button"
            onClick={onConfirmMuteAll}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-850 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
          >
            <MicOffIcon size={16} />
            Mute everyone
          </button>
        </div>
      )}
    </div>
  );
}

function ParticipantRow({
  name,
  you = false,
  isHost = false,
  audio,
  video: _video,
  hand,
  hostControls,
}: {
  name: string;
  you?: boolean;
  isHost?: boolean;
  audio: boolean;
  video: boolean;
  hand: boolean;
  hostControls?: React.ReactNode;
}) {
  void _video;
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
      <Avatar name={name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {name}
          {you && <span className="text-zinc-500"> (you)</span>}
        </p>
        {isHost && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
            Host
          </p>
        )}
      </div>
      {hand && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white"
          title="Hand raised"
        >
          <HandIcon size={13} />
        </span>
      )}
      {!audio && (
        <span className="text-zinc-500" title="Muted">
          <MicOffIcon size={16} />
        </span>
      )}
      {hostControls}
    </div>
  );
}

function HostRowControls({
  participant,
  onMute,
  onLowerHand,
  onRemove,
}: {
  participant: RemoteParticipant;
  onMute: () => void;
  onLowerHand: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
      {participant.hand && (
        <button
          type="button"
          onClick={onLowerHand}
          title="Lower hand"
          aria-label={`Lower ${participant.name}'s hand`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          <HandIcon size={14} />
        </button>
      )}
      <button
        type="button"
        onClick={onMute}
        title="Mute"
        aria-label={`Mute ${participant.name}`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
      >
        <MicOffIcon size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove from meeting"
        aria-label={`Remove ${participant.name} from meeting`}
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-brand-soft hover:text-brand"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

/* ---------------- Chat ---------------- */

function ChatTab({ api }: { api: MeetingApi }) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [api.chat]);

  const send = () => {
    api.sendChat(draft);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {api.chat.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-zinc-300">No messages yet</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-zinc-600">
              Messages are visible to everyone in this meeting while it lasts.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {api.chat.map((m) => (
              <div key={m.id}>
                <p className="mb-1 text-xs text-zinc-500">
                  <span className={`font-medium ${m.mine ? 'text-brand' : 'text-zinc-300'}`}>
                    {m.mine ? 'You' : m.name}
                  </span>
                  <span className="ml-2">
                    {new Date(m.ts).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
                <p className="inline-block max-w-full break-words rounded-xl rounded-tl-sm bg-ink-800 px-3.5 py-2 text-sm leading-relaxed text-zinc-100">
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.07] p-3">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Send a message"
            maxLength={1000}
            aria-label="Send a message"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-850 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-brand/60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-all hover:bg-brand-deep active:scale-95 disabled:opacity-40"
          >
            <SendIcon size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

export { initialsOf };
