'use client';

/**
 * useMeeting — owns the entire in-call state machine:
 * - Socket.io signaling (join, offers/answers/ICE relay, presence, chat, reactions, host commands)
 * - Mesh WebRTC: one RTCPeerConnection per peer for camera/mic, plus a
 *   separate one per peer for screen share (keeps track routing unambiguous)
 * - Perfect-negotiation (polite/impolite by socket-id order) so renegotiation
 *   from screen-share add/remove never deadlocks
 * - Active-speaker detection via per-stream audio analysers
 */

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  playJoinSound,
  playLeaveSound,
  playMessageSound,
  playHandSound,
} from '@/components/sounds';

export interface RemoteParticipant {
  id: string;
  name: string;
  audio: boolean;
  video: boolean;
  screen: boolean;
  hand: boolean;
  handRaisedAt: number;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
  mine: boolean;
}

export interface CaptionItem {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
}

export interface ReactionBurst {
  id: string;
  from: string;
  emoji: string;
}

export interface Toast {
  id: number;
  text: string;
}

export type CallStatus =
  | 'connecting'
  | 'in-call'
  | 'reconnecting'
  | 'removed'
  | 'ended'
  | 'room-full';

/**
 * ICE servers. STUN-only by default (zero third-party accounts needed).
 * For restrictive networks, override with NEXT_PUBLIC_ICE_SERVERS as a JSON
 * array, e.g.:
 *   NEXT_PUBLIC_ICE_SERVERS='[{"urls":["turn:turn.example.com:3478?transport=tcp"],"username":"u","credential":"p"}]'
 */
function getIceServers(): RTCConfiguration {
  const fromEnv =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_ICE_SERVERS
      : undefined;
  if (fromEnv) {
    try {
      const parsed = JSON.parse(fromEnv);
      if (Array.isArray(parsed) && parsed.length > 0)
        return { iceServers: parsed };
    } catch {
      console.warn('[convene] invalid NEXT_PUBLIC_ICE_SERVERS, using default');
    }
  }
  return {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ],
  };
}

const ICE_SERVERS: RTCConfiguration = getIceServers();

interface PeerEntry {
  pc: RTCPeerConnection;
  screenPc: RTCPeerConnection | null;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  iceSent: number;
  iceReceived: number;
  /** ICE candidates that arrived before the remote description; flushed after. */
  pendingIce: RTCIceCandidateInit[];
  /** Guards against overlapping createOffer calls on one PC. */
  makingOffer: boolean;
}

interface JoinOpts {
  roomId: string;
  name: string;
  localStream: MediaStream | null;
  audioOn: boolean;
  videoOn: boolean;
  /** Creator host key from the URL hash (never shared in invite links). */
  hostKey?: string;
}

export function useMeeting(opts: JoinOpts) {
  const { roomId } = opts;

  const [status, setStatus] = useState<CallStatus>('connecting');
  const [selfId, setSelfId] = useState('');
  const [hostId, setHostId] = useState<string | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemoteParticipant>>({});
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, MediaStream>
  >({});
  const [remoteScreens, setRemoteScreens] = useState<
    Record<string, MediaStream>
  >({});
  const [connStates, setConnStates] = useState<Record<string, string>>({});
  const [audioOn, setAudioOn] = useState(opts.audioOn);
  const [videoOn, setVideoOn] = useState(opts.videoOn);
  const [screenOn, setScreenOn] = useState(false);
  const [localScreenStream, setLocalScreenStream] =
    useState<MediaStream | null>(null);
  const [handRaised, setHandRaised] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState<ReactionBurst[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<'grid' | 'speaker'>('grid');
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [captions, setCaptions] = useState<CaptionItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [activeMicId, setActiveMicId] = useState<string>('');
  const [activeCamId, setActiveCamId] = useState<string>('');

  // ---- refs (stable handles for socket callbacks) ----
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(opts.localStream);
  const localScreenRef = useRef<MediaStream | null>(null);
  const nameRef = useRef(opts.name);
  const selfIdRef = useRef('');
  const remotesRef = useRef<Record<string, RemoteParticipant>>({});
  const audioOnRef = useRef(opts.audioOn);
  const videoOnRef = useRef(opts.videoOn);
  const screenOnRef = useRef(false);
  const handRef = useRef(false);
  const chatOpenRef = useRef(false);
  const toastIdRef = useRef(0);
  const hasMediaRef = useRef(!!opts.localStream);
  const statusRef = useRef<CallStatus>('connecting');
  const hostKeyRef = useRef(opts.hostKey || '');
  const screenStartingRef = useRef(false);
  const lastToastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  localStreamRef.current = opts.localStream;
  hasMediaRef.current = !!opts.localStream;
  chatOpenRef.current = chatOpen;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Debug handle for automated smoke tests (harmless in production).
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__conveneDebug = {
      peerIds: () => [...peersRef.current.keys()],
      connStates: () => {
        const o: Record<string, string> = {};
        peersRef.current.forEach((p, k) => {
          o[k] = p.pc.connectionState;
        });
        return o;
      },
      status: () => statusRef.current,
      remoteCount: () => Object.keys(remotesRef.current).length,
      pcInfo: () => {
        const o: Record<string, unknown> = {};
        peersRef.current.forEach((p, k) => {
          o[k] = {
            signaling: p.pc.signalingState,
            ice: p.pc.iceConnectionState,
            conn: p.pc.connectionState,
            gathering: p.pc.iceGatheringState,
            hasLocal: !!p.pc.localDescription,
            hasRemote: !!p.pc.remoteDescription,
            iceSent: p.iceSent,
            iceReceived: p.iceReceived,
            remoteVideoTracks: p.stream?.getVideoTracks().length ?? 0,
            remoteAudioTracks: p.stream?.getAudioTracks().length ?? 0,
          };
        });
        return o;
      },
    };
    return () => {
      delete w.__conveneDebug;
    };
  }, []);

  // Device unplugged mid-call: a track ends on its own. Reflect it in the
  // UI and tell peers, instead of showing a stale "camera on" tile.
  useEffect(() => {
    const s = opts.localStream;
    if (!s) return;
    const handlers = new Map<MediaStreamTrack, () => void>();
    for (const t of s.getTracks()) {
      const h = () => {
        if (t.kind === 'audio') {
          audioOnRef.current = false;
          setAudioOn(false);
        } else {
          videoOnRef.current = false;
          setVideoOn(false);
        }
        emitState();
        notify(
          t.kind === 'audio'
            ? 'Microphone disconnected'
            : 'Camera disconnected'
        );
      };
      handlers.set(t, h);
      t.addEventListener('ended', h);
    }
    return () => {
      for (const [t, h] of handlers) t.removeEventListener('ended', h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.localStream]);

  // When media resolves asynchronously (e.g. instant 1-click meeting start), attach tracks immediately
  useEffect(() => {
    localStreamRef.current = opts.localStream;
    hasMediaRef.current = !!opts.localStream;
    if (opts.localStream) {
      for (const peer of peersRef.current.values()) {
        const stream = opts.localStream;
        const senders = peer.pc.getSenders();
        for (const track of stream.getTracks()) {
          const existing = senders.find((s) => s.track?.kind === track.kind);
          if (existing) {
            existing.replaceTrack(track).catch(() => undefined);
          } else {
            try {
              peer.pc.addTrack(track, stream);
            } catch {}
          }
        }
      }
      emitState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.localStream]);

  // ================= helpers =================

  const notify = (text: string) => {
    // Dedupe rapid repeats (e.g. rejoin storms) — same text within 3s is one toast.
    const now = Date.now();
    const last = lastToastRef.current;
    if (last.text === text && now - last.at < 3000) return;
    lastToastRef.current = { text, at: now };
    const id = ++toastIdRef.current;
    setToasts((t) => [...t.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4500);
  };

  const collectState = () => ({
    audio: audioOnRef.current,
    video: videoOnRef.current,
    screen: screenOnRef.current,
    hand: handRef.current,
  });

  const emitState = () => {
    socketRef.current?.emit('media-state', collectState());
  };

  const setRemoteEntry = (p: RemoteParticipant) => {
    remotesRef.current = { ...remotesRef.current, [p.id]: p };
    setRemotes(remotesRef.current);
  };

  const removeRemoteEntry = (id: string) => {
    const next = { ...remotesRef.current };
    delete next[id];
    remotesRef.current = next;
    setRemotes(next);
    setRemoteStreams((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
    setRemoteScreens((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
    setConnStates((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
    setPinnedId((p) => (p === id ? null : p));
  };

  const wirePeerConnection = (
    peerId: string,
    pc: RTCPeerConnection,
    kind: 'media' | 'screen'
  ) => {
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const peer = peersRef.current.get(peerId);
        if (peer) peer.iceSent++;
        socketRef.current?.emit('signal', {
          to: peerId,
          kind,
          type: 'ice',
          payload: e.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (e) => {
      const peer = peersRef.current.get(peerId);
      if (!peer) return;
      if (kind === 'media') {
        if (!peer.stream) peer.stream = new MediaStream();
        for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
          if (!peer.stream.getTrackById(track.id)) peer.stream.addTrack(track);
        }
        const stream = peer.stream;
        setRemoteStreams((s) => (s[peerId] === stream ? s : { ...s, [peerId]: stream }));
      } else {
        if (!peer.screenStream) peer.screenStream = new MediaStream();
        for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
          if (!peer.screenStream.getTrackById(track.id))
            peer.screenStream.addTrack(track);
        }
        const stream = peer.screenStream;
        setRemoteScreens((s) =>
          s[peerId] === stream ? s : { ...s, [peerId]: stream }
        );
      }
    };

    // Fired when the remote side removes a track (e.g. stopped sharing):
    // the sender also broadcasts screen:false via media-state, which clears
    // the tile — this keeps the stream object itself tidy.
    pc.onnegotiationneeded = () => {
      if (pc.signalingState !== 'stable') return;
      void renegotiate(peerId, kind);
    };

    pc.onconnectionstatechange = () => {
      setConnStates((s) => ({ ...s, [peerId]: pc.connectionState }));
      // Self-heal: a dead connection gets an ICE restart while the socket
      // is alive, instead of a permanently frozen tile.
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          /* noop */
        }
        void renegotiate(peerId, kind);
      }
    };
  };

  const attachLocalTracks = (peerId: string, kind: 'media' | 'screen') => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    if (kind === 'media') {
      const stream = localStreamRef.current;
      if (!stream) return;
      const senders = peer.pc.getSenders();
      for (const track of stream.getTracks()) {
        if (!senders.some((s) => s.track === track)) {
          peer.pc.addTrack(track, stream);
        }
      }
    } else if (peer.screenPc) {
      const stream = localScreenRef.current;
      if (!stream) return;
      const senders = peer.screenPc.getSenders();
      for (const track of stream.getTracks()) {
        if (!senders.some((s) => s.track === track)) {
          peer.screenPc.addTrack(track, stream);
        }
      }
    }
  };

  const getPeer = (peerId: string): PeerEntry => {
    let peer = peersRef.current.get(peerId);
    if (!peer) {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peer = { pc, screenPc: null, stream: null, screenStream: null, iceSent: 0, iceReceived: 0, pendingIce: [], makingOffer: false };
      peersRef.current.set(peerId, peer);
      wirePeerConnection(peerId, pc, 'media');
      attachLocalTracks(peerId, 'media');
    }
    return peer;
  };

  const getScreenPc = (peerId: string): RTCPeerConnection => {
    const peer = getPeer(peerId);
    if (!peer.screenPc) {
      const spc = new RTCPeerConnection(ICE_SERVERS);
      peer.screenPc = spc;
      wirePeerConnection(peerId, spc, 'screen');
      attachLocalTracks(peerId, 'screen');
    }
    return peer.screenPc;
  };

  const renegotiate = async (peerId: string, kind: 'media' | 'screen') => {
    const socket = socketRef.current;
    if (!socket) return;
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    const pc = kind === 'media' ? peer.pc : peer.screenPc;
    if (!pc || pc.signalingState !== 'stable') return;
    if (peer.makingOffer) return;
    peer.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: peerId, kind, type: 'offer', payload: offer });
    } catch (err) {
      console.warn('[convene] renegotiate failed', err);
    } finally {
      peer.makingOffer = false;
    }
  };

  /** Newcomer initiates the media connection to an existing peer. */
  const callPeer = (peerId: string) => {
    getPeer(peerId);
    void renegotiate(peerId, 'media');
    // If I'm sharing my screen, also open the screen channel to them.
    if (screenOnRef.current) {
      getScreenPc(peerId);
      void renegotiate(peerId, 'screen');
    }
  };

  /** Flush ICE candidates that arrived before the remote description. */
  const flushPendingIce = async (
    peer: PeerEntry,
    pc: RTCPeerConnection
  ) => {
    const queued = peer.pendingIce.splice(0);
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* drop malformed/duplicate candidates */
      }
    }
  };

  const handleSignal = async (
    from: string,
    kind: 'media' | 'screen',
    type: string,
    payload: unknown
  ) => {
    const socket = socketRef.current;
    if (!socket || !socket.id) return;
    try {
      if (type === 'offer') {
        const peer = getPeer(from);
        const pc = kind === 'screen' ? getScreenPc(from) : peer.pc;
        const polite = socket.id < from;
        if (pc.signalingState !== 'stable') {
          if (!polite) return; // impolite: ignore, our in-flight offer wins
          await pc.setRemoteDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        await flushPendingIce(peer, pc);
        attachLocalTracks(from, kind);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, kind, type: 'answer', payload: answer });
      } else if (type === 'answer') {
        const peer = peersRef.current.get(from);
        const pc = kind === 'screen' ? peer?.screenPc : peer?.pc;
        if (!pc || !peer) return;
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        await flushPendingIce(peer, pc);
      } else if (type === 'ice') {
        const peer = peersRef.current.get(from);
        const pc = kind === 'screen' ? peer?.screenPc : peer?.pc;
        if (!pc || !peer || !payload) return;
        peer.iceReceived++;
        // Candidates can arrive before the offer/answer round-trip finishes;
        // queue them instead of dropping.
        if (!pc.remoteDescription) {
          peer.pendingIce.push(payload as RTCIceCandidateInit);
          return;
        }
        await pc.addIceCandidate(payload as RTCIceCandidateInit);
      }
    } catch (err) {
      console.warn('[convene] signal handling failed', err);
    }
  };

  const cleanupPeer = (peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (!peer) return;
    try {
      peer.pc.ontrack = null;
      peer.pc.onicecandidate = null;
      peer.pc.onnegotiationneeded = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    } catch {
      /* noop */
    }
    try {
      peer.screenPc?.close();
    } catch {
      /* noop */
    }
    peersRef.current.delete(peerId);
  };

  const cleanupAll = () => {
    // Terminal states must not keep capturing: stop local tracks too.
    const s = localStreamRef.current;
    if (s) for (const t of s.getTracks()) t.stop();
    const ss = localScreenRef.current;
    if (ss) for (const t of ss.getTracks()) t.stop();
    localStreamRef.current = null;
    localScreenRef.current = null;
    for (const peerId of [...peersRef.current.keys()]) cleanupPeer(peerId);
    removeAllRemoteState();
  };

  const removeAllRemoteState = () => {
    remotesRef.current = {};
    setRemotes({});
    setRemoteStreams({});
    setRemoteScreens({});
    setConnStates({});
  };

  // ================= public actions =================

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      notify('Microphone unavailable — check browser permissions');
      return;
    }
    const next = !audioOnRef.current;
    for (const t of stream.getAudioTracks()) t.enabled = next;
    audioOnRef.current = next;
    setAudioOn(next);
    emitState();
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) {
      notify('Camera unavailable — check browser permissions');
      return;
    }
    const next = !videoOnRef.current;
    for (const t of stream.getVideoTracks()) t.enabled = next;
    videoOnRef.current = next;
    setVideoOn(next);
    emitState();
  };

  const startScreenShare = async () => {
    // Guard BEFORE the picker opens: rapid clicks must not stack pickers.
    if (screenOnRef.current || screenStartingRef.current) return;
    screenStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      localScreenRef.current = stream;
      setLocalScreenStream(stream);
      screenOnRef.current = true;
      setScreenOn(true);
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          void stopScreenShare();
        };
      }
      for (const peerId of peersRef.current.keys()) {
        getScreenPc(peerId);
        void renegotiate(peerId, 'screen');
      }
      emitState();
      notify('You are now sharing your screen');
    } catch {
      // User cancelled the picker — stay silent.
    } finally {
      screenStartingRef.current = false;
    }
  };

  const stopScreenShare = async () => {
    if (!screenOnRef.current && !localScreenRef.current) return;
    const stream = localScreenRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
      localScreenRef.current = null;
    }
    setLocalScreenStream(null);
    // Tear down the screen peer connections entirely: a fresh PC on the next
    // share avoids the stale-sender renegotiation trap (share worked once).
    for (const peer of peersRef.current.values()) {
      if (peer.screenPc) {
        try {
          peer.screenPc.close();
        } catch {
          /* noop */
        }
        peer.screenPc = null;
      }
    }
    screenOnRef.current = false;
    setScreenOn(false);
    emitState();
  };

  const toggleHand = () => {
    const next = !handRef.current;
    handRef.current = next;
    setHandRaised(next);
    emitState();
    if (next) notify('You raised your hand');
  };

  const sendChat = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    socketRef.current?.emit('chat-message', { text: clean.slice(0, 1000) });
  };

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit('reaction', { emoji });
    // Show it on your own tile instantly.
    const burst: ReactionBurst = {
      id: `local-${Date.now()}`,
      from: selfIdRef.current,
      emoji,
    };
    setReactions((r) => [...r.slice(-11), burst]);
    window.setTimeout(() => {
      setReactions((r) => r.filter((x) => x.id !== burst.id));
    }, 2300);
  };

  const markChatRead = () => setUnread(0);

  const sendCaption = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const item: CaptionItem = {
      id: `cap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from: selfIdRef.current,
      name: nameRef.current,
      text: clean,
      ts: Date.now(),
    };
    setCaptions((prev) => [...prev.slice(-3), item]);
    socketRef.current?.emit('caption', { text: clean });
    window.setTimeout(() => {
      setCaptions((prev) => prev.filter((c) => c.id !== item.id));
    }, 4500);
  };

  const updateNotes = (text: string) => {
    setNotes(text);
    socketRef.current?.emit('notes-update', { text });
  };

  const switchMic = async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = audioOnRef.current;

      const current = localStreamRef.current;
      if (current) {
        const oldTrack = current.getAudioTracks()[0];
        if (oldTrack) {
          current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        current.addTrack(newTrack);
      }

      for (const peer of peersRef.current.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }
      setActiveMicId(deviceId);
      notify('Microphone switched');
    } catch {
      notify('Failed to switch microphone');
    }
  };

  const switchCam = async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      newTrack.enabled = videoOnRef.current;

      const current = localStreamRef.current;
      if (current) {
        const oldTrack = current.getVideoTracks()[0];
        if (oldTrack) {
          current.removeTrack(oldTrack);
          oldTrack.stop();
        }
        current.addTrack(newTrack);
      }

      for (const peer of peersRef.current.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }
      setActiveCamId(deviceId);
      notify('Camera switched');
    } catch {
      notify('Failed to switch camera');
    }
  };

  // ---- host actions ----
  const isHost = hostId !== null && hostId === selfId;

  const muteAll = () => {
    if (!isHost) return;
    socketRef.current?.emit('mute-all');
    notify('Muted everyone');
  };

  const muteParticipant = (targetId: string) => {
    if (!isHost || targetId === selfIdRef.current) return;
    socketRef.current?.emit('mute-peer', { targetId });
  };

  const removeParticipant = (targetId: string) => {
    if (!isHost || targetId === selfIdRef.current) return;
    socketRef.current?.emit('remove-peer', { targetId });
  };

  const lowerHand = (targetId: string) => {
    socketRef.current?.emit('lower-hand', { targetId });
  };

  const lowerAllHands = () => {
    if (!isHost) return;
    socketRef.current?.emit('lower-all-hands');
  };

  const endMeeting = () => {
    if (!isHost) return;
    socketRef.current?.emit('end-meeting');
  };

  const leave = () => {
    socketRef.current?.emit('leave-room');
    cleanupAll();
    stopLocalTracks();
    setLocalScreenStream(null);
  };

  const stopLocalTracks = () => {
    const s = localStreamRef.current;
    if (s) for (const t of s.getTracks()) t.stop();
    const sc = localScreenRef.current;
    if (sc) for (const t of sc.getTracks()) t.stop();
  };

  // ================= socket lifecycle =================
  // Keep latest logic in a ref so socket handlers (registered once) never go stale.
  const logicRef = useRef({
    handleSignal,
    callPeer,
    emitState,
    notify,
    cleanupAll,
    cleanupPeer,
    setRemoteEntry,
    removeRemoteEntry,
    collectState,
  });
  logicRef.current = {
    handleSignal,
    callPeer,
    emitState,
    notify,
    cleanupAll,
    cleanupPeer,
    setRemoteEntry,
    removeRemoteEntry,
    collectState,
  };

  useEffect(() => {
    const socket: Socket = io({
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 100,
      reconnectionDelayMax: 600,
      timeout: 4000,
      forceNew: true,
    });
    socketRef.current = socket;

    let hasJoined = false;

    const emitJoin = () => {
      selfIdRef.current = socket.id || '';
      setSelfId(socket.id || '');
      socket.emit('join-room', {
        roomId,
        name: nameRef.current,
        hostKey: hostKeyRef.current || undefined,
      });
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on('connect', () => {
      emitJoin();
    });

    socket.on('connect_error', (err) => {
      console.warn('[convene] socket connection error:', err);
    });

    // Auto-retry emit if room-state is delayed (e.g. server busy or cold boot)
    const joinRetryTimer = setInterval(() => {
      if (!hasJoined && socket.connected) {
        emitJoin();
      }
    }, 1200);

    socket.on('disconnect', () => {
      setStatus((s) => (s === 'in-call' ? 'reconnecting' : s));
    });

    socket.on('room-state', (data: { participants: RemoteParticipant[]; hostId: string | null }) => {
      hasJoined = true;
      clearInterval(joinRetryTimer);
      const L = logicRef.current;
      // Fresh state: drop any stale peer connections (covers rejoin after reconnect).
      for (const peerId of [...peersRef.current.keys()]) L.cleanupPeer(peerId);
      const next: Record<string, RemoteParticipant> = {};
      for (const p of data.participants) {
        if (p.id === socket.id) continue;
        next[p.id] = p;
      }
      remotesRef.current = next;
      setRemotes(next);
      setHostId(data.hostId);
      setStatus('in-call');
      // Tell everyone our actual mic/cam state (server defaults may differ).
      socket.emit('media-state', L.collectState());
      // Newcomer initiates a media offer to every existing peer.
      for (const peerId of Object.keys(next)) L.callPeer(peerId);
    });

    socket.on('user-joined', (data: { participant: RemoteParticipant; hostId: string | null }) => {
      const L = logicRef.current;
      if (data.participant.id === socket.id) return;
      playJoinSound();
      L.setRemoteEntry(data.participant);
      setHostId(data.hostId);
      L.notify(`${data.participant.name} joined`);
      // If I'm sharing my screen, open the screen channel to the newcomer —
      // they can't initiate it because their screen is off.
      if (screenOnRef.current) {
        getScreenPc(data.participant.id);
        void renegotiate(data.participant.id, 'screen');
      }
    });

    socket.on('user-left', (data: { id: string }) => {
      const L = logicRef.current;
      const name = remotesRef.current[data.id]?.name ?? 'Someone';
      playLeaveSound();
      L.cleanupPeer(data.id);
      L.removeRemoteEntry(data.id);
      L.notify(`${name} left`);
    });

    socket.on('peer-state', (data: { participant: RemoteParticipant }) => {
      const L = logicRef.current;
      const p = data.participant;
      if (p.id === socket.id) return;
      const oldP = remotesRef.current[p.id];
      if (p.hand && (!oldP || !oldP.hand)) {
        playHandSound();
      }
      L.setRemoteEntry(p);
      // If they stopped sharing, drop the screen tile promptly.
      if (!p.screen) {
        setRemoteScreens((s) => {
          if (!(p.id in s)) return s;
          const n = { ...s };
          delete n[p.id];
          return n;
        });
      }
    });

    socket.on('signal', (data: { from: string; kind: 'media' | 'screen'; type: string; payload: unknown }) => {
      void logicRef.current.handleSignal(data.from, data.kind, data.type, data.payload);
    });

    socket.on('chat-message', (msg: { id: string; from: string; name: string; text: string; ts: number }) => {
      const mine = msg.from === selfIdRef.current;
      if (!mine) playMessageSound();
      setChat((c) => [...c.slice(-199), { ...msg, mine }]);
      if (!mine && !chatOpenRef.current) setUnread((u) => u + 1);
    });

    socket.on('caption', (data: CaptionItem) => {
      setCaptions((prev) => [...prev.slice(-3), data]);
      window.setTimeout(() => {
        setCaptions((prev) => prev.filter((c) => c.id !== data.id));
      }, 4500);
    });

    socket.on('notes-update', (data: { text: string }) => {
      setNotes(data.text);
    });

    socket.on('reaction', (r: { id: string; from: string; name: string; emoji: string }) => {
      const burst: ReactionBurst = { id: r.id, from: r.from, emoji: r.emoji };
      setReactions((list) => [...list.slice(-11), burst]);
      window.setTimeout(() => {
        setReactions((list) => list.filter((x) => x.id !== burst.id));
      }, 2300);
    });

    socket.on('force-mute', () => {
      const stream = localStreamRef.current;
      if (stream && audioOnRef.current) {
        for (const t of stream.getAudioTracks()) t.enabled = false;
        audioOnRef.current = false;
        setAudioOn(false);
        logicRef.current.emitState();
      }
      logicRef.current.notify('You were muted by the host');
    });

    socket.on('removed', () => {
      logicRef.current.cleanupAll();
      setStatus('removed');
      // Stay out: disable auto-reconnect so the ejected client can't rejoin
      // on the same socket. A fresh visit (new connection) may rejoin.
      socket.disconnect();
    });

    socket.on('room-full', () => {
      setStatus('room-full');
    });

    socket.on('meeting-ended', () => {
      logicRef.current.cleanupAll();
      setStatus('ended');
    });

    socket.on('host-changed', (data: { hostId: string }) => {
      setHostId(data.hostId);
      if (data.hostId === selfIdRef.current) {
        logicRef.current.notify('You are now the host');
      }
    });

    return () => {
      clearInterval(joinRetryTimer);
      logicRef.current.cleanupAll();
      const s = localStreamRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
      const sc = localScreenRef.current;
      if (sc) for (const t of sc.getTracks()) t.stop();
      setLocalScreenStream(null);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ================= active speaker detection =================
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let timer: number | null = null;
    let stopped = false;
    const analysers: { id: string; analyser: AnalyserNode; data: Uint8Array }[] = [];

    const setup = async () => {
      try {
        ctx = new AudioContext();
        await ctx.resume().catch(() => undefined);
        if (stopped) {
          await ctx.close().catch(() => undefined);
          return;
        }
        const mk = (id: string, stream: MediaStream, audible: boolean) => {
          if (!audible || !stream.getAudioTracks().length || !ctx) return;
          try {
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            src.connect(analyser);
            analysers.push({
              id,
              analyser,
              data: new Uint8Array(analyser.frequencyBinCount),
            });
          } catch {
            /* some browsers block re-sourcing a stream — skip */
          }
        };
        if (localStreamRef.current)
          mk('self', localStreamRef.current, audioOnRef.current);
        for (const [id, stream] of Object.entries(remoteStreams)) {
          mk(id, stream, remotesRef.current[id]?.audio !== false);
        }
        timer = window.setInterval(() => {
          if (stopped) return;
          let best: string | null = null;
          let bestLevel = 0;
          for (const a of analysers) {
            a.analyser.getByteTimeDomainData(a.data);
            let sum = 0;
            for (let i = 0; i < a.data.length; i++) {
              const v = (a.data[i] - 128) / 128;
              sum += v * v;
            }
            const level = Math.sqrt(sum / a.data.length);
            if (level > bestLevel) {
              bestLevel = level;
              best = a.id;
            }
          }
          setSpeakingId(bestLevel > 0.045 ? best : null);
        }, 250);
      } catch {
        /* audio analysis unavailable — speaking indicator stays off */
      }
    };

    void setup();
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
      if (ctx) void ctx.close().catch(() => undefined);
    };
  }, [opts.localStream, remoteStreams, audioOn, remotes]);

  const handCount = Object.values(remotes).filter((p) => p.hand).length;

  return {
    status,
    selfId,
    hostId,
    isHost,
    remotes,
    remoteStreams,
    remoteScreens,
    connStates,
    audioOn,
    videoOn,
    screenOn,
    localScreenStream,
    handRaised,
    handCount,
    chat,
    unread,
    reactions,
    toasts,
    speakingId,
    pinnedId,
    setPinnedId,
    layout,
    setLayout,
    peopleOpen,
    setPeopleOpen,
    chatOpen,
    setChatOpen,
    notesOpen,
    setNotesOpen,
    captions,
    sendCaption,
    notes,
    updateNotes,
    switchMic,
    switchCam,
    activeMicId,
    activeCamId,
    hasMedia: hasMediaRef.current,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    toggleHand,
    sendChat,
    sendReaction,
    markChatRead,
    muteAll,
    muteParticipant,
    removeParticipant,
    lowerHand,
    lowerAllHands,
    endMeeting,
    leave,
    notify,
  };
}

export type MeetingApi = ReturnType<typeof useMeeting>;
