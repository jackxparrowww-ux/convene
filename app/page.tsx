'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogoMark,
  MicIcon,
  CamIcon,
  ScreenIcon,
  ChatIcon,
  UsersIcon,
  HandIcon,
  SmileIcon,
  DotsIcon,
  PhoneDownIcon,
  ShieldIcon,
  ZapIcon,
  LinkIcon,
  CheckIcon,
} from '@/components/icons';

function makeRoomId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = new Uint32Array(12);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) out += '-';
    out += chars[buf[i] % chars.length];
  }
  return out;
}

/**
 * Creator host key: minted when starting a meeting, kept in the URL hash
 * (`#host=…`) so it never leaks into copied invite links. Presenting it
 * makes the creator the host, even if they join after guests.
 */
function makeHostKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  const buf = new Uint32Array(24);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 24; i++) out += chars[buf[i] % chars.length];
  return out;
}

/* ---------- Hero mock call UI (pure CSS, no fake video) ---------- */
function HeroMock() {
  const tiles = [
    { initials: 'AR', name: 'Aarav', speaking: true },
    { initials: 'MK', name: 'Meera', speaking: false },
    { initials: 'RS', name: 'Rohan', speaking: false },
    { initials: 'SP', name: 'Sara', speaking: false },
  ];
  return (
    <div className="relative rounded-2xl border border-white/10 bg-ink-900/90 shadow-pop overflow-hidden">
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-3 flex items-center gap-2 text-xs text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand soft-pulse" />
          convene.app/room/design-review
        </span>
      </div>
      {/* tiles */}
      <div className="grid grid-cols-2 gap-2.5 p-4">
        {tiles.map((t) => (
          <div
            key={t.name}
            className={`relative aspect-video rounded-xl bg-ink-800 flex items-center justify-center overflow-hidden ${
              t.speaking ? 'hero-speaking' : 'ring-1 ring-white/[0.06]'
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-700 text-sm font-semibold text-zinc-300">
              {t.initials}
            </span>
            <span className="absolute bottom-2 left-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-zinc-300">
              {t.name}
            </span>
            {t.speaking && (
              <span className="hero-reaction absolute bottom-8 left-1/2 -translate-x-1/2 text-2xl">
                👍
              </span>
            )}
          </div>
        ))}
      </div>
      {/* control bar mock */}
      <div className="flex items-center justify-center gap-2 border-t border-white/[0.06] px-4 py-3.5">
        {[MicIcon, CamIcon, ScreenIcon, SmileIcon, HandIcon, ChatIcon, UsersIcon, DotsIcon].map(
          (Icon, i) => (
            <span
              key={i}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-700 text-zinc-300"
            >
              <Icon size={18} />
            </span>
          )
        )}
        <span className="ml-1 flex h-10 w-14 items-center justify-center rounded-full bg-brand text-white">
          <PhoneDownIcon size={18} />
        </span>
      </div>
    </div>
  );
}

/* ---------- Feature card ---------- */
function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-ink-900 p-6 transition-colors duration-200 hover:border-brand/40">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold text-zinc-100">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const startMeeting = () =>
    router.push(`/room/${makeRoomId()}#host=${makeHostKey()}`);
  const joinWithCode = () => {
    const clean = code.trim().replace(/[^a-zA-Z0-9-]/g, '');
    if (clean) router.push(`/room/${clean}`);
  };

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <span className="text-lg font-semibold tracking-tight text-white">
            Convene
          </span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
          <a href="#technology" className="transition-colors hover:text-white">
            Technology
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              document
                .getElementById('join-code')
                ?.scrollIntoView({ behavior: 'smooth' })
            }
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white sm:block"
          >
            Join a meeting
          </button>
          <button
            onClick={startMeeting}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-deep active:scale-[0.98]"
          >
            Start a meeting
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 pb-20 pt-12 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium tracking-wide text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              BROWSER-BASED VIDEO MEETINGS
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
              Meet face to face,
              <br />
              from anywhere.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-zinc-400">
              Convene is video conferencing that lives in your browser. No
              downloads, no accounts for guests — create a meeting, share the
              link, and talk in seconds.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={startMeeting}
                className="rounded-full bg-brand px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-brand-deep active:scale-[0.98]"
              >
                Start a meeting
              </button>
              <div className="flex items-center gap-2">
                <input
                  id="join-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinWithCode()}
                  placeholder="Enter meeting code"
                  className="w-44 rounded-full border border-white/10 bg-ink-900 px-5 py-3.5 text-[15px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-brand/60"
                />
                <button
                  onClick={joinWithCode}
                  className="rounded-full border border-white/15 px-6 py-3.5 text-[15px] font-medium text-zinc-200 transition-colors hover:border-white/30 hover:text-white active:scale-[0.98]"
                >
                  Join
                </button>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
              {['No downloads', 'No sign-up for guests', 'Free to host'].map(
                (t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckIcon size={15} className="text-brand" />
                    {t}
                  </span>
                )
              )}
            </div>
          </div>
          <HeroMock />
        </div>

        {/* Features */}
        <section id="features" className="border-t border-white/[0.06] py-20">
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand">
            FEATURES
          </p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-white">
            Everything a meeting needs. Nothing it doesn't.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<CamIcon size={22} />}
              title="Crisp video, zero setup"
              body="Join from any modern browser. Grid and speaker views, pin anyone, and a live speaking indicator that follows the conversation."
            />
            <Feature
              icon={<ScreenIcon size={22} />}
              title="Screen sharing"
              body="Present your full screen or a single window. Shared content takes the stage; everyone else moves to a filmstrip."
            />
            <Feature
              icon={<ChatIcon size={22} />}
              title="In-call chat"
              body="A side-panel chat runs alongside every call. Drop links, notes, and follow-ups without interrupting the speaker."
            />
            <Feature
              icon={<SmileIcon size={22} />}
              title="Reactions & raise hand"
              body="React with emoji that float up from your tile. Raise your hand to get noticed — hosts see everyone in order."
            />
            <Feature
              icon={<UsersIcon size={22} />}
              title="Host controls"
              body="The meeting creator can mute everyone, mute or remove individuals, lower hands, and end the meeting for all."
            />
            <Feature
              icon={<ShieldIcon size={22} />}
              title="Peer-to-peer media"
              body="Media travels directly between participants over encrypted peer-to-peer connections. No accounts needed for guests."
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-white/[0.06] py-20">
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand">
            HOW IT WORKS
          </p>
          <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-white">
            Talking in three steps.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                n: '01',
                t: 'Create',
                b: 'Click “Start a meeting” and you get a meeting room instantly — the creator keeps host controls. Check your camera and mic in the green room first.',
              },
              {
                n: '02',
                t: 'Share',
                b: 'Copy the meeting link and send it anywhere — email, chat, text. Guests join from their browser, no sign-up.',
              },
              {
                n: '03',
                t: 'Meet',
                b: 'Talk with crisp video, share your screen, chat, and react. The host keeps everything running smoothly.',
              },
            ].map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/[0.07] bg-ink-900 p-6"
              >
                <p className="mb-3 text-sm font-semibold text-brand">{s.n}</p>
                <h3 className="mb-1.5 text-[15px] font-semibold text-zinc-100">
                  {s.t}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-400">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Technology — honest scoping */}
        <section
          id="technology"
          className="border-t border-white/[0.06] py-20"
        >
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-brand">
                TECHNOLOGY
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-white">
                Direct connections.
                <br />
                No middlemen.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-zinc-400">
                Convene connects participants directly with WebRTC — the same
                open standard behind the world's biggest calling apps. Your
                audio and video travel peer-to-peer over encrypted channels,
                not through our servers.
              </p>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: <ZapIcon size={20} />,
                  t: 'Low latency by construction',
                  b: 'Direct peer connections keep latency low — no media round-trips through a central server.',
                },
                {
                  icon: <UsersIcon size={20} />,
                  t: 'Built for small teams',
                  b: 'Peer-to-peer shines with small groups — Convene is at its best with up to 8 people in a room.',
                },
                {
                  icon: <LinkIcon size={20} />,
                  t: 'Self-hosted signaling',
                  b: 'The lightweight signaling server runs anywhere Node.js runs. Your infrastructure, your rules.',
                },
              ].map((r) => (
                <div
                  key={r.t}
                  className="flex gap-4 rounded-2xl border border-white/[0.07] bg-ink-900 p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    {r.icon}
                  </div>
                  <div>
                    <h3 className="mb-1 text-[15px] font-semibold text-zinc-100">
                      {r.t}
                    </h3>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      {r.b}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/[0.06] py-20 text-center">
          <h2 className="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-white">
            Your next meeting is one click away.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-zinc-400">
            No downloads. No accounts for guests. Just talk.
          </p>
          <button
            onClick={startMeeting}
            className="mt-8 rounded-full bg-brand px-8 py-4 text-[15px] font-semibold text-white transition-all hover:bg-brand-deep active:scale-[0.98]"
          >
            Start a meeting — it's free
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="text-sm font-semibold text-white">Convene</span>
          </div>
          <p className="text-sm text-zinc-600">
            Browser-based video meetings. Built for teams who just want to talk.
          </p>
          <p className="text-sm text-zinc-600">© 2026 Convene</p>
        </div>
      </footer>
    </div>
  );
}
