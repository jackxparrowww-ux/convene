# Convene — self-hosted browser video meetings

Video conferencing that lives in your browser. No downloads, no accounts for
guests — create a meeting, share the link, and talk in seconds.

**Stack:** Next.js 14 (App Router) + TypeScript + Socket.io signaling +
native mesh WebRTC. STUN-only by default. Zero third-party API keys.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Production:

```bash
npm run build
npm start        # NODE_ENV=production node server.js
```

Set `PORT` to change the port (default 3000).

## Deploy it

Convene needs **one long-running Node.js process** (the Socket.io signaling
server in `server.js`). Recommended: any VPS, a Docker container, Railway /
Render / Fly.io (web service, not serverless).

**Vercel serverless is not suitable as-is**: serverless functions can't hold
the persistent WebSocket connections Socket.io needs. (A Vercel deploy would
require moving signaling to an external Socket.io host.)

## What works

| Feature | Status |
|---|---|
| Create / join via link or code | ✅ Built |
| Green-room preview (name, mic/cam, mic meter, device pick, speaker test) | ✅ Built |
| HD video (720p ideal), grid + speaker views, pin, speaking indicator | ✅ Built |
| Screen share (own peer connection, stage + filmstrip) | ✅ Built |
| In-call chat (side panel / bottom sheet, unread badge) | ✅ Built |
| Emoji reactions (tile-anchored) + ordered raise-hand queue | ✅ Built |
| Participants panel with search | ✅ Built |
| Host controls: mute all, mute individual, remove, lower hands, end for all | ✅ Built |
| Creator host key: the meeting creator keeps host even if guests join first | ✅ Built |
| Host auto-transfer when the host leaves | ✅ Built |
| Meeting timer, copy invite link | ✅ Built |
| Reconnecting / removed / ended / room-full states | ✅ Built |
| In-call device switching (change mic/camera mid-call) | ❌ Missing (roadmap — pick devices in the green room before joining) |
| Recording | ❌ Missing (roadmap) |
| Live captions | ❌ Missing (roadmap) |
| Breakout rooms | ❌ Missing (roadmap) |
| Phone dial-in | ❌ Missing (roadmap) |

## Honest limitations

- **Mesh topology.** Every participant connects directly to every other
  participant. This is at its best with **up to ~8 people**; large meetings
  need an SFU (e.g. LiveKit / mediasoup) — a deliberate architecture trade,
  not a bug.
- **No TURN server by default.** STUN-only means some restrictive NAT /
  firewall combinations can't establish media. For those networks, point
  `NEXT_PUBLIC_ICE_SERVERS` at your own TURN server (e.g. coturn):
  ```bash
  NEXT_PUBLIC_ICE_SERVERS='[{"urls":["turn:turn.example.com:3478"],"username":"u","credential":"p"}]' npm run build
  ```
- **Chat is in-memory.** Messages live for the meeting only — nothing is
  stored.
- **No accounts.** Anyone with the link can join and pick any display name.

## Tests

```bash
npm run typecheck     # TypeScript
npm run build         # production build
npm run smoke:signal  # 20+ signaling protocol checks (Socket.io)
npm run smoke:call     # real 2-client Chromium call: join → SDP → ICE →
                       # chat/reactions/hand-raise through the UI, zero errors
```

Note: `smoke:call` runs in an environment where UDP is blocked, so ICE can't
reach `connected` there — it asserts everything up to that point (SDP
handshake complete both ways, ICE candidates trickling both directions,
remote audio+video tracks negotiated, UI flows, no console errors).
