'use client';

/** In-call experience: stage (grid / speaker / screen-share), header, dock, panels. */

import { useEffect, useMemo, useState } from 'react';
import { useMeeting } from '@/hooks/useMeeting';
import VideoTile from './VideoTile';
import ControlBar from './ControlBar';
import SidePanel from './SidePanel';
import {
  LogoMark,
  CopyIcon,
  CheckIcon,
  GridIcon,
  SpeakerViewIcon,
  ClockIcon,
} from './icons';
import { ConfirmDialog, ToastStack } from './ui';

interface RoomProps {
  roomId: string;
  name: string;
  stream: MediaStream | null;
  audioOn: boolean;
  videoOn: boolean;
  /** Creator host key from the URL hash; undefined for guests. */
  hostKey?: string;
  onExit: () => void;
}

function formatElapsed(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function gridCols(n: number) {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  if (n <= 6) return 'grid-cols-2 sm:grid-cols-3';
  if (n <= 9) return 'grid-cols-3';
  if (n <= 12) return 'grid-cols-3 sm:grid-cols-4';
  // 13+: keep tiles usable on phones — 3 columns max below sm.
  return 'grid-cols-3 sm:grid-cols-5';
}

type ConfirmState =
  | { kind: 'mute-all' }
  | { kind: 'remove'; targetId: string; targetName: string }
  | { kind: 'end' }
  | null;

export default function MeetingRoom({
  roomId,
  name,
  stream,
  audioOn,
  videoOn,
  hostKey,
  onExit,
}: RoomProps) {
  const api = useMeeting({ roomId, name, localStream: stream, audioOn, videoOn, hostKey });
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [copied, setCopied] = useState(false);
  const [joinedAt, setJoinedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const inviteLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/room/${roomId}`
      : '';

  useEffect(() => {
    if (api.status === 'in-call' && joinedAt === null) setJoinedAt(Date.now());
  }, [api.status, joinedAt]);

  useEffect(() => {
    if (joinedAt === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [joinedAt]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = inviteLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    api.notify('Invite link copied to clipboard');
    window.setTimeout(() => setCopied(false), 2000);
  };

  // ---------- derived tile data ----------
  const videoTiles = useMemo(
    () => [
      {
        id: 'self',
        name,
        stream,
        muted: !api.audioOn,
        videoOff: !api.videoOn,
        hand: api.handRaised,
        isSelf: true,
        isHost: api.isHost,
      },
      ...Object.values(api.remotes)
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          id: p.id,
          name: p.name,
          stream: api.remoteStreams[p.id] ?? null,
          muted: !p.audio,
          videoOff: !p.video,
          hand: p.hand,
          isSelf: false,
          isHost: api.hostId === p.id,
        })),
    ],
    [
      name,
      stream,
      api.audioOn,
      api.videoOn,
      api.handRaised,
      api.isHost,
      api.remotes,
      api.remoteStreams,
      api.hostId,
    ]
  );

  const screenOwners = useMemo(() => {
    const list: { id: string; label: string; stream: MediaStream | null }[] = [];
    if (api.screenOn) {
      list.push({
        id: 'self',
        label: 'Your screen',
        stream: api.localScreenStream,
      });
    }
    for (const [id, s] of Object.entries(api.remoteScreens)) {
      list.push({
        id,
        label: `${api.remotes[id]?.name ?? 'Someone'}'s screen`,
        stream: s,
      });
    }
    return list;
  }, [api.screenOn, api.localScreenStream, api.remoteScreens, api.remotes]);

  const reactionsFor = (tileId: string) =>
    api.reactions.filter((r) =>
      tileId === 'self' ? r.from === api.selfId : r.from === tileId
    );

  const speakingFor = (tileId: string) =>
    tileId === 'self' ? api.speakingId === 'self' : api.speakingId === tileId;

  const tileNode = (
    t: (typeof videoTiles)[number],
    opts: { fill?: boolean; small?: boolean } = {}
  ) => (
    <VideoTile
      key={t.id}
      stream={t.stream}
      name={t.name}
      muted={t.muted}
      videoOff={t.videoOff}
      handRaised={t.hand}
      speaking={speakingFor(t.id)}
      pinned={api.pinnedId === t.id}
      isSelf={t.isSelf}
      isHost={t.isHost}
      mirror={t.isSelf}
      reactions={reactionsFor(t.id)}
      onTogglePin={() =>
        api.setPinnedId(api.pinnedId === t.id ? null : t.id)
      }
      fill={opts.fill}
    />
  );

  const panelOpen = api.peopleOpen || api.chatOpen;
  const panelTab = api.chatOpen ? 'chat' : 'people';

  const togglePeople = () => {
    if (api.chatOpen) {
      api.setChatOpen(false);
      api.setPeopleOpen(true);
    } else {
      api.setPeopleOpen(!api.peopleOpen);
    }
  };
  const toggleChat = () => {
    if (api.peopleOpen) {
      api.setPeopleOpen(false);
      api.setChatOpen(true);
    } else {
      const next = !api.chatOpen;
      api.setChatOpen(next);
      if (next) api.markChatRead();
    }
  };

  // ---------- terminal states ----------
  if (api.status === 'removed' || api.status === 'ended' || api.status === 'room-full') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-ink-950 px-6 text-center">
        <LogoMark size={44} />
        <h1 className="mt-6 text-xl font-semibold text-white">
          {api.status === 'removed'
            ? 'You were removed by the host'
            : api.status === 'room-full'
              ? 'This meeting is full'
              : 'This meeting has ended'}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
          {api.status === 'removed'
            ? 'The host removed you from this meeting. You can rejoin with the invite link if they let you back in.'
            : api.status === 'room-full'
              ? 'This room has reached its participant limit. Try again later.'
              : 'The host ended this meeting for everyone. Thanks for joining.'}
        </p>
        <button
          onClick={onExit}
          className="mt-8 rounded-full bg-brand px-7 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-deep active:scale-[0.98]"
        >
          Return to home
        </button>
      </div>
    );
  }

  if (api.status === 'connecting') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center bg-ink-950 px-4 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
        <p className="mt-5 text-sm font-medium text-zinc-300">Joining meeting…</p>
        <p className="mt-1 text-xs text-zinc-500">Connecting to real-time mesh signaling...</p>
        <button
          onClick={onExit}
          className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-white transition"
        >
          Cancel & Return
        </button>
      </div>
    );
  }

  const screensActive = screenOwners.length > 0;
  const mainScreen =
    screensActive &&
    (screenOwners.find((s) => s.id === api.pinnedId) ?? screenOwners[0]);

  const speakerMainId =
    api.pinnedId && videoTiles.some((t) => t.id === api.pinnedId)
      ? api.pinnedId
      : api.speakingId && videoTiles.some((t) => t.id === api.speakingId)
        ? api.speakingId
        : 'self';
  const speakerMain = videoTiles.find((t) => t.id === speakerMainId)!;
  const speakerRest = videoTiles.filter((t) => t.id !== speakerMainId);

  return (
    <div className="flex h-dvh flex-col bg-ink-950">
      {/* ---------- header ---------- */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={28} />
          <span className="hidden text-[15px] font-semibold text-white md:block">
            Convene
          </span>
          <button
            onClick={copyInvite}
            title="Copy invite link"
            className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-ink-900 px-3 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:border-brand/50 hover:text-white"
          >
            <span className="max-w-[120px] truncate sm:max-w-[200px]">
              {roomId}
            </span>
            {copied ? (
              <CheckIcon size={13} className="shrink-0 text-brand" />
            ) : (
              <CopyIcon size={13} className="shrink-0" />
            )}
          </button>
          {joinedAt !== null && (
            <span className="hidden items-center gap-1.5 text-xs tabular-nums text-zinc-400 sm:flex">
              <ClockIcon size={14} />
              {formatElapsed(Math.floor((now - joinedAt) / 1000))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!screensActive && (
            <div className="flex rounded-full bg-ink-800 p-1">
              <button
                onClick={() => api.setLayout('grid')}
                aria-label="Grid view"
                title="Grid view"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  api.layout === 'grid'
                    ? 'bg-ink-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <GridIcon size={16} />
              </button>
              <button
                onClick={() => api.setLayout('speaker')}
                aria-label="Speaker view"
                title="Speaker view"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  api.layout === 'speaker'
                    ? 'bg-ink-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <SpeakerViewIcon size={16} />
              </button>
            </div>
          )}
          <button
            onClick={copyInvite}
            className="hidden items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-white/25 hover:text-white sm:flex"
          >
            <CopyIcon size={15} />
            Invite
          </button>
        </div>
      </header>

      {/* ---------- stage ---------- */}
      <main className="relative min-h-0 flex-1">
        {screensActive && mainScreen ? (
          /* screen-share stage */
          <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:p-3 lg:flex-row">
            <div className="relative flex min-h-0 flex-[3] items-center justify-center">
              <VideoTile
                stream={mainScreen.stream}
                name={mainScreen.label}
                muted
                videoOff={false}
                handRaised={false}
                speaking={false}
                pinned={false}
                isScreen
                reactions={[]}
                onTogglePin={() => undefined}
                fill
              />
              {mainScreen.id === 'self' && (
                <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
                  <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-black/70 py-2 pl-4 pr-2 text-sm text-white backdrop-blur">
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-brand soft-pulse" />
                      You're presenting
                    </span>
                    <button
                      onClick={() => void api.stopScreenShare()}
                      className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
              {videoTiles.map((t) => (
                <div key={t.id} className="w-40 shrink-0 lg:w-full">
                  {tileNode(t)}
                </div>
              ))}
            </div>
          </div>
        ) : api.layout === 'speaker' ? (
          /* speaker stage */
          <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:p-3 lg:flex-row">
            <div className="flex min-h-0 flex-[3] items-center justify-center">
              {tileNode(speakerMain, { fill: true })}
            </div>
            <div className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0">
              {speakerRest.map((t) => (
                <div key={t.id} className="w-40 shrink-0 lg:w-full">
                  {tileNode(t)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* grid stage */
          <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto p-2 pb-24 sm:p-4 sm:pb-28">
            <div
              className={`grid w-full gap-2 sm:gap-3 ${gridCols(videoTiles.length)} ${
                videoTiles.length === 1 ? 'max-w-4xl' : ''
              }`}
            >
              {videoTiles.map((t) => tileNode(t))}
            </div>
          </div>
        )}

        {/* first-here empty state */}
        {api.status === 'in-call' && videoTiles.length === 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
            <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-ink-900/95 py-2.5 pl-5 pr-2.5 text-sm text-zinc-200 shadow-pop backdrop-blur animate-slide-up">
              <span className="shrink-0 whitespace-nowrap">
                You're the first here
              </span>
              <button
                onClick={copyInvite}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-deep"
              >
                <CopyIcon size={13} />
                Copy link
              </button>
            </div>
          </div>
        )}

        {/* reconnecting overlay */}
        {api.status === 'reconnecting' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink-950/85 backdrop-blur-sm">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
            <p className="mt-4 text-sm text-zinc-300">
              Connection lost — reconnecting…
            </p>
          </div>
        )}

        {/* ---------- control dock ---------- */}
        <ControlBar
          audioOn={api.audioOn}
          videoOn={api.videoOn}
          screenOn={api.screenOn}
          handRaised={api.handRaised}
          hasMedia={api.hasMedia}
          onToggleAudio={api.toggleAudio}
          onToggleVideo={api.toggleVideo}
          onToggleScreen={() =>
            api.screenOn ? void api.stopScreenShare() : void api.startScreenShare()
          }
          onToggleHand={api.toggleHand}
          onSendReaction={api.sendReaction}
          peopleOpen={api.peopleOpen}
          onTogglePeople={togglePeople}
          handCount={api.handCount}
          chatOpen={api.chatOpen}
          onToggleChat={toggleChat}
          unread={api.unread}
          layout={api.layout}
          onToggleLayout={() =>
            api.setLayout(api.layout === 'grid' ? 'speaker' : 'grid')
          }
          isHost={api.isHost}
          onMuteAll={() => setConfirm({ kind: 'mute-all' })}
          onLowerAllHands={api.lowerAllHands}
          onEndMeeting={() => setConfirm({ kind: 'end' })}
          onCopyInvite={copyInvite}
          onLeave={() => {
            api.leave();
            onExit();
          }}
        />
      </main>

      {/* ---------- side panel ---------- */}
      {panelOpen && (
        <SidePanel
          api={api}
          selfName={name}
          tab={panelTab}
          setTab={(t) => {
            if (t === 'chat') {
              api.setPeopleOpen(false);
              api.setChatOpen(true);
              api.markChatRead();
            } else {
              api.setChatOpen(false);
              api.setPeopleOpen(true);
            }
          }}
          onClose={() => {
            api.setPeopleOpen(false);
            api.setChatOpen(false);
          }}
          onConfirmRemove={(id, targetName) =>
            setConfirm({ kind: 'remove', targetId: id, targetName })
          }
          onConfirmMuteAll={() => setConfirm({ kind: 'mute-all' })}
        />
      )}

      {/* ---------- confirm dialogs ---------- */}
      <ConfirmDialog
        open={confirm?.kind === 'mute-all'}
        title="Mute everyone?"
        body="Every participant's microphone will be turned off. They can unmute themselves afterwards."
        confirmLabel="Mute everyone"
        danger
        onConfirm={() => {
          api.muteAll();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        title={`Remove ${confirm?.kind === 'remove' ? confirm.targetName : ''}?`}
        body="They will leave the meeting immediately. They can rejoin with the same link if you let them back in."
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          if (confirm?.kind === 'remove') api.removeParticipant(confirm.targetId);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'end'}
        title="End meeting for everyone?"
        body="All participants will be disconnected and the meeting will close."
        confirmLabel="End meeting"
        danger
        onConfirm={() => {
          api.endMeeting();
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ToastStack toasts={api.toasts} />
    </div>
  );
}
