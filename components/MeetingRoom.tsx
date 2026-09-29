'use client';

/** In-call experience: stage (grid / speaker / screen-share), header, dock, panels, recording, live captions, device settings. */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMeeting } from '@/hooks/useMeeting';
import VideoTile from './VideoTile';
import ControlBar from './ControlBar';
import SidePanel from './SidePanel';
import DeviceSettingsModal from './DeviceSettingsModal';
import InstallAppButton from './InstallAppButton';
import {
  LogoMark,
  CopyIcon,
  CheckIcon,
  GridIcon,
  SpeakerViewIcon,
  ClockIcon,
  XIcon,
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
  const [now, setNow] = useState(0);
  const [inviteLink, setInviteLink] = useState('');

  // Additional Google Meet-style features
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showReadyCard, setShowReadyCard] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInviteLink(`${window.location.origin}/room/${roomId}`);
      setNow(Date.now());
    }
  }, [roomId]);

  useEffect(() => {
    if (api.status === 'in-call' && joinedAt === null) setJoinedAt(Date.now());
  }, [api.status, joinedAt]);

  useEffect(() => {
    if (joinedAt === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [joinedAt]);

  // Recording timer
  useEffect(() => {
    if (!recording) {
      setRecordSeconds(0);
      return;
    }
    const t = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const copyInvite = useCallback(async () => {
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
  }, [inviteLink, api]);

  // ---------- Live Captions (Speech Recognition) ----------
  useEffect(() => {
    if (!captionsOn) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      api.notify('Live captions require Chrome, Edge, or Safari');
      setCaptionsOn(false);
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          if (transcript) {
            api.sendCaption(transcript);
          }
        }
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        console.warn('[Captions error]', e);
      }
    };

    rec.onend = () => {
      if (captionsOn && recognitionRef.current) {
        try {
          rec.start();
        } catch {}
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      api.notify('Live captions turned on');
    } catch {
      setCaptionsOn(false);
    }

    return () => {
      try {
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [captionsOn, api]);

  const toggleCaptions = () => {
    setCaptionsOn((prev) => !prev);
  };

  // ---------- In-Call Recording (MediaRecorder) ----------
  const toggleRecording = async () => {
    if (recording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
      }
      setRecording(false);
      return;
    }

    try {
      const recStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: true,
      });
      recordStreamRef.current = recStream;

      const chunks: Blob[] = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(recStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Convene-Meeting-${roomId}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        api.notify('Meeting recording saved to Downloads');
        setRecording(false);
      };

      recStream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.start(1000);
      setRecording(true);
      api.notify('Recording started');
    } catch {
      api.notify('Recording cancelled or screen share denied');
    }
  };

  // ---------- Picture-in-Picture ----------
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const videoEl = document.querySelector('video');
        if (videoEl && videoEl.readyState >= 2) {
          await videoEl.requestPictureInPicture();
          api.notify('Picture-in-picture activated');
        } else {
          api.notify('No active video stream for Picture-in-Picture');
        }
      }
    } catch {
      api.notify('Picture-in-Picture not supported or active');
    }
  };

  // ---------- Keyboard Shortcuts (Google Meet style) ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      // Ctrl+D or D: toggle audio
      if ((e.ctrlKey || e.metaKey || !e.altKey) && key === 'd') {
        e.preventDefault();
        api.toggleAudio();
      }
      // Ctrl+E or E: toggle video
      else if ((e.ctrlKey || e.metaKey || !e.altKey) && key === 'e') {
        e.preventDefault();
        api.toggleVideo();
      }
      // C: toggle captions
      else if (key === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleCaptions();
      }
      // H: toggle hand
      else if (key === 'h' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        api.toggleHand();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [api]);

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

  const panelOpen = api.peopleOpen || api.chatOpen || api.notesOpen;
  const panelTab: 'people' | 'chat' | 'notes' = api.notesOpen
    ? 'notes'
    : api.chatOpen
      ? 'chat'
      : 'people';

  const togglePeople = () => {
    if (api.peopleOpen) {
      api.setPeopleOpen(false);
    } else {
      api.setChatOpen(false);
      api.setNotesOpen(false);
      api.setPeopleOpen(true);
    }
  };

  const toggleChat = () => {
    if (api.chatOpen) {
      api.setChatOpen(false);
    } else {
      api.setPeopleOpen(false);
      api.setNotesOpen(false);
      api.setChatOpen(true);
      api.markChatRead();
    }
  };

  const toggleNotes = () => {
    if (api.notesOpen) {
      api.setNotesOpen(false);
    } else {
      api.setPeopleOpen(false);
      api.setChatOpen(false);
      api.setNotesOpen(true);
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
          {api.status === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-brand soft-pulse" />
              <span className="hidden sm:inline">Connecting…</span>
            </span>
          ) : joinedAt !== null ? (
            <span className="hidden items-center gap-1.5 text-xs tabular-nums text-zinc-400 sm:flex">
              <ClockIcon size={14} />
              {formatElapsed(Math.floor((now - joinedAt) / 1000))}
            </span>
          ) : null}

          {/* Recording Badge */}
          {recording && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-400 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>REC {formatElapsed(recordSeconds)}</span>
            </div>
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

        {/* Live Closed Captions Overlay */}
        {captionsOn && api.captions.length > 0 && (
          <div className="pointer-events-none absolute bottom-24 inset-x-4 z-30 flex justify-center">
            <div className="max-w-2xl rounded-2xl bg-black/85 px-4 py-2 text-center text-sm font-medium text-white shadow-xl backdrop-blur border border-white/10 animate-fade-in">
              <span className="text-brand-bright font-semibold mr-2">
                {api.captions[api.captions.length - 1].name}:
              </span>
              <span>{api.captions[api.captions.length - 1].text}</span>
            </div>
          </div>
        )}

        {/* Google Meet-style "Your meeting's ready" instant card */}
        {api.status === 'in-call' && showReadyCard && Object.keys(api.remotes).length === 0 && (
          <div className="pointer-events-auto absolute bottom-24 left-4 z-30 w-80 rounded-2xl border border-white/15 bg-ink-900/95 p-4 shadow-pop backdrop-blur animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Your meeting's ready</h3>
              <button
                onClick={() => setShowReadyCard(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
                title="Dismiss"
              >
                <XIcon size={14} />
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Share this meeting link with others you want in the meeting:
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-ink-850 px-3 py-2 border border-white/10">
              <span className="font-mono text-xs text-zinc-300 truncate">
                {inviteLink}
              </span>
              <button
                onClick={copyInvite}
                className="shrink-0 text-brand-bright hover:text-white"
                title="Copy link"
              >
                {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyInvite}
                className="flex-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep transition"
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => {
                    navigator.share?.({
                      title: 'Join my Convene meeting',
                      url: inviteLink,
                    }).catch(() => undefined);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 transition"
                >
                  Share
                </button>
              )}
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
          captionsOn={captionsOn}
          onToggleCaptions={toggleCaptions}
          recording={recording}
          onToggleRecording={toggleRecording}
          onOpenSettings={() => setSettingsOpen(true)}
          onTogglePip={togglePip}
          notesOpen={api.notesOpen}
          onToggleNotes={toggleNotes}
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
            if (recording && mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
            }
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
              api.setNotesOpen(false);
              api.setChatOpen(true);
              api.markChatRead();
            } else if (t === 'notes') {
              api.setPeopleOpen(false);
              api.setChatOpen(false);
              api.setNotesOpen(true);
            } else {
              api.setChatOpen(false);
              api.setNotesOpen(false);
              api.setPeopleOpen(true);
            }
          }}
          onClose={() => {
            api.setPeopleOpen(false);
            api.setChatOpen(false);
            api.setNotesOpen(false);
          }}
          onConfirmRemove={(id, targetName) =>
            setConfirm({ kind: 'remove', targetId: id, targetName })
          }
          onConfirmMuteAll={() => setConfirm({ kind: 'mute-all' })}
        />
      )}

      {/* ---------- Device Settings Modal ---------- */}
      <DeviceSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSelectMic={(deviceId) => api.switchMic(deviceId)}
        onSelectCam={(deviceId) => api.switchCam(deviceId)}
        currentMicId={api.activeMicId}
        currentCamId={api.activeCamId}
      />

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

      <InstallAppButton variant="floating" />
      <ToastStack toasts={api.toasts} />
    </div>
  );
}
