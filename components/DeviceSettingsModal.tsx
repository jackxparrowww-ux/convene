'use client';

import { useEffect, useState } from 'react';
import { XIcon, MicIcon, CamIcon, SpeakerIcon } from './icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMic: (deviceId: string) => void;
  onSelectCam: (deviceId: string) => void;
  onSelectSpeaker?: (deviceId: string) => void;
  currentMicId?: string;
  currentCamId?: string;
  currentSpeakerId?: string;
}

export default function DeviceSettingsModal({
  isOpen,
  onClose,
  onSelectMic,
  onSelectCam,
  onSelectSpeaker,
  currentMicId,
  currentCamId,
  currentSpeakerId,
}: Props) {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [testingSpeaker, setTestingSpeaker] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      })
      .catch(() => undefined);
  }, [isOpen]);

  if (!isOpen) return null;

  const playTestSound = () => {
    setTestingSpeaker(true);
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => setTestingSpeaker(false), 500);
    } catch {
      setTestingSpeaker(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-pop">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <h2 className="text-lg font-semibold text-white">Audio & Video Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Microphone */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <MicIcon size={15} /> Microphone
            </label>
            <select
              value={currentMicId}
              onChange={(e) => onSelectMic(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-ink-850 px-3.5 py-2.5 text-sm text-zinc-200 outline-none focus:border-brand/60"
            >
              {audioInputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <CamIcon size={15} /> Camera
            </label>
            <select
              value={currentCamId}
              onChange={(e) => onSelectCam(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-ink-850 px-3.5 py-2.5 text-sm text-zinc-200 outline-none focus:border-brand/60"
            >
              {videoInputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Speakers */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <SpeakerIcon size={15} /> Speakers
              </label>
              <div className="mt-2 flex gap-2">
                <select
                  value={currentSpeakerId}
                  onChange={(e) => onSelectSpeaker?.(e.target.value)}
                  className="flex-1 rounded-xl border border-white/10 bg-ink-850 px-3.5 py-2.5 text-sm text-zinc-200 outline-none focus:border-brand/60"
                >
                  {audioOutputs.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Speaker ${i + 1}`}
                    </option>
                  ))}
                </select>
                <button
                  onClick={playTestSound}
                  disabled={testingSpeaker}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
                >
                  {testingSpeaker ? 'Playing...' : 'Test'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-7 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-brand-deep transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
