'use client';

/**
 * Pre-join "green room": name prompt, mirrored camera preview, mic/camera
 * toggles, live mic level, device selection, and a speaker/mic/camera check.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LogoMark,
  MicIcon,
  MicOffIcon,
  CamIcon,
  CamOffIcon,
  ChevronDownIcon,
  AlertIcon,
  RefreshIcon,
  SpeakerIcon,
} from './icons';

export interface JoinInfo {
  name: string;
  stream: MediaStream | null;
  audioOn: boolean;
  videoOn: boolean;
}

interface DeviceLists {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

export default function PreJoin({
  roomId,
  onJoin,
  onBack,
}: {
  roomId: string;
  onJoin: (info: JoinInfo) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('convene_username');
    if (saved) setName(saved);
  }, []);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [devices, setDevices] = useState<DeviceLists>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selMic, setSelMic] = useState('');
  const [selCam, setSelCam] = useState('');
  const [selSpeaker, setSelSpeaker] = useState('');
  const [showDevices, setShowDevices] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nameRef = useRef<HTMLInputElement>(null);
  // Set when the user joins: stream ownership transfers to the meeting,
  // so the unmount cleanup must not stop it.
  const joiningRef = useRef(false);

  const stopStream = useCallback((s: MediaStream | null) => {
    if (s) for (const t of s.getTracks()) t.stop();
  }, []);

  const acquire = useCallback(
    async (micId?: string, camId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId } } : true,
          // Request HD; `ideal` degrades gracefully on weaker cameras.
          video: {
            ...(camId ? { deviceId: { exact: camId } } : {}),
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        setStream((prev) => {
          stopStream(prev);
          return s;
        });
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audioInputs: list.filter((d) => d.kind === 'audioinput'),
          videoInputs: list.filter((d) => d.kind === 'videoinput'),
          audioOutputs: list.filter((d) => d.kind === 'audiooutput'),
        });
      } catch {
        setError(
          'Could not access your camera or microphone. Check browser permissions, or continue without them.'
        );
        // Don't leak the previous capture when re-acquiring fails.
        setStream((prev) => {
          stopStream(prev);
          return null;
        });
      } finally {
        setLoading(false);
      }
    },
    [stopStream]
  );

  useEffect(() => {
    void acquire();
    nameRef.current?.focus();
    return () => {
      // On join the stream is handed to the meeting — ownership transfers,
      // so the cleanup must not stop it. Every other unmount stops capture.
      if (joiningRef.current) return;
      setStream((prev) => {
        stopStream(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Callback ref: attaches whenever the <video> mounts (including after the
  // loading spinner unmounts) and when the stream changes.
  const attachPreview = useCallback(
    (el: HTMLVideoElement | null) => {
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().catch(() => undefined);
      }
    },
    [stream]
  );

  // Apply mic/cam toggle state to tracks
  useEffect(() => {
    if (!stream) return;
    for (const t of stream.getAudioTracks()) t.enabled = audioOn;
    for (const t of stream.getVideoTracks()) t.enabled = videoOn;
  }, [stream, audioOn, videoOn]);

  // Live mic level meter
  useEffect(() => {
    if (!stream || !audioOn) {
      setMicLevel(0);
      return;
    }
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let last = 0;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
        const nowTs = performance.now();
        if (nowTs - last > 90) {
          last = nowTs;
          setMicLevel(level);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      /* meter unavailable */
    }
    return () => {
      cancelAnimationFrame(raf);
      if (ctx) void ctx.close().catch(() => undefined);
    };
  }, [stream, audioOn]);

  const changeMic = (id: string) => {
    setSelMic(id);
    void acquire(id || undefined, selCam || undefined);
  };
  const changeCam = (id: string) => {
    setSelCam(id);
    void acquire(selMic || undefined, id || undefined);
  };

  const testSpeaker = async () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 660;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain);
      gain.connect(dest);
      const audio = new Audio();
      audio.srcObject = dest.stream;
      const withSink = audio as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
      };
      if (selSpeaker && withSink.setSinkId) {
        await withSink.setSinkId(selSpeaker).catch(() => undefined);
      }
      await audio.play().catch(() => undefined);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
    } catch {
      /* noop */
    }
  };

  const join = () => {
    const clean = name.trim();
    if (!clean) {
      nameRef.current?.focus();
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('convene_username', clean);
    }
    // Transfer stream ownership to the meeting before unmounting.
    joiningRef.current = true;
    onJoin({ name: clean.slice(0, 40), stream, audioOn, videoOn });
  };

  const canJoin = name.trim().length > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <button onClick={onBack} className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="text-lg font-semibold text-white">Convene</span>
        </button>
        <span className="max-w-[38vw] truncate rounded-full border border-white/10 bg-ink-900 px-3.5 py-1.5 font-mono text-xs text-zinc-400">
          {roomId}
        </span>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-6 pb-16 pt-6 lg:grid-cols-[1fr_380px] lg:pt-10">
        {/* preview */}
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink-800 ring-1 ring-white/[0.07]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
            </div>
          ) : stream && videoOn ? (
            <video
              ref={attachPreview}
              autoPlay
              playsInline
              muted
              className="mirror h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
              <CamOffIcon size={36} />
              <p className="text-sm">
                {error ? 'Camera unavailable' : 'Camera is off'}
              </p>
            </div>
          )}

          {/* preview toggles */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2.5">
            <button
              onClick={() => setAudioOn((v) => !v)}
              aria-label={audioOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 ${
                audioOn
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-brand text-white hover:bg-brand-deep'
              }`}
            >
              {audioOn ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
            </button>
            <button
              onClick={() => setVideoOn((v) => !v)}
              aria-label={videoOn ? 'Turn camera off' : 'Turn camera on'}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 ${
                videoOn
                  ? 'bg-white/10 text-white hover:bg-white/20'
                  : 'bg-brand text-white hover:bg-brand-deep'
              }`}
            >
              {videoOn ? <CamIcon size={20} /> : <CamOffIcon size={20} />}
            </button>
          </div>

          {/* mic level */}
          {stream && audioOn && (
            <div className="absolute bottom-5 right-5 hidden items-center gap-2 sm:flex" aria-hidden="true">
              <MicIcon size={14} className="text-zinc-400" />
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-100"
                  style={{ width: `${Math.round(micLevel * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* join card */}
        <div className="rounded-2xl border border-white/[0.08] bg-ink-900 p-6">
          <h1 className="text-xl font-semibold text-white">Ready to join?</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Check how you look and sound, then jump in.
          </p>

          <label className="mt-6 block text-sm font-medium text-zinc-300">
            Your name
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="e.g. Aarav Sharma"
              maxLength={40}
              className="mt-2 w-full rounded-xl border border-white/10 bg-ink-850 px-4 py-3 text-[15px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-brand/60"
            />
          </label>

          {error && (
            <div className="mt-4 flex gap-3 rounded-xl border border-brand/30 bg-brand-soft p-3.5 text-sm text-zinc-300">
              <AlertIcon size={18} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <p>{error}</p>
                <button
                  onClick={() => void acquire()}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand hover:text-white"
                >
                  <RefreshIcon size={13} />
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* device settings */}
          <button
            onClick={() => setShowDevices((v) => !v)}
            className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/10 bg-ink-850 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20"
            aria-expanded={showDevices}
          >
            Check devices
            <ChevronDownIcon
              size={16}
              className={`transition-transform ${showDevices ? 'rotate-180' : ''}`}
            />
          </button>
          {showDevices && (
            <div className="mt-3 space-y-3 animate-fade-in">
              <DeviceSelect
                label="Microphone"
                value={selMic}
                onChange={changeMic}
                options={devices.audioInputs}
              />
              <DeviceSelect
                label="Camera"
                value={selCam}
                onChange={changeCam}
                options={devices.videoInputs}
              />
              {devices.audioOutputs.length > 0 && (
                <DeviceSelect
                  label="Speaker"
                  value={selSpeaker}
                  onChange={setSelSpeaker}
                  options={devices.audioOutputs}
                />
              )}
              <button
                onClick={testSpeaker}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-850 py-2.5 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                <SpeakerIcon size={16} />
                Play test sound
              </button>
            </div>
          )}

          <button
            onClick={join}
            disabled={!canJoin}
            className="mt-6 w-full rounded-full bg-brand py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join meeting
          </button>
          {!canJoin && (
            <p className="mt-2.5 text-center text-xs text-zinc-600">
              Enter your name to join
            </p>
          )}
          <button
            onClick={onBack}
            className="mt-3 w-full py-2 text-center text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Back to home
          </button>
        </div>
      </main>
    </div>
  );
}

function DeviceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: MediaDeviceInfo[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/10 bg-ink-850 px-4 py-2.5 pr-10 text-sm text-zinc-200 outline-none transition-colors focus:border-brand/60"
        >
          <option value="">System default</option>
          {options.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `${label} ${i + 1}`}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
        />
      </span>
    </label>
  );
}

