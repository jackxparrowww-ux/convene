# Convene — Ultra-Fast, Self-Hosted Video Meetings (Faster than Google Meet)

Convene is a world-class, ultra-fast video conferencing web app that runs in your browser or installs directly as a native desktop/mobile app. Zero wait times, zero accounts for guests — start an instant meeting with 1 click, share the link, and talk in milliseconds.

**Stack:** Next.js 14 (App Router) + TypeScript + Socket.io signaling + native mesh WebRTC + Progressive Web App (PWA). Zero third-party API keys required.

---

## ⚡ Key Highlights

- **⚡ 1-Click Instant Meeting:** One-click launch from the homepage drops you straight into the call stage in under 200ms with automatic media initialization.
- **📲 Direct App Download (PWA):** Install Convene as a native standalone desktop app (Windows, macOS, Linux) or mobile app (Android, iOS) directly from your browser.
- **📹 In-Call Meeting Recording:** 1-click meeting & screen recording with high-quality `.webm` video export saved directly to your device without external tools.
- **💬 Real-Time Live Captions:** On-device speech recognition transcribes speech live and displays subtitle pills with speaker attribution.
- **📝 Real-Time Collaborative Notes:** Shared notepad synchronized across all participants via WebSocket for instant meeting minutes and action items.
- **⚙️ Mid-Call Device Switcher:** Swap microphones, webcams, and speakers on the fly without refreshing or disconnecting.
- **🖼️ Picture-in-Picture (PiP):** Keep eyes on participants and presentations while multitasking.
- **🔔 Zero-Latency Sound Effects:** Synthesized Web Audio chimes for join, leave, message, and hand-raise events.
- **⌨️ Google Meet Keyboard Shortcuts:** `D` (mute mic), `E` (toggle camera), `C` (toggle captions), `H` (raise hand).

---

## 🚀 Quick Start

### 1-Click Launch (Windows)
Double-click **`run.bat`** in the repository root. It will automatically check dependencies, compile the production build, launch the server, and open `http://localhost:3000` in your default browser.

### Manual Terminal Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or run optimized production server (recommended for maximum speed)
npm run build
npm start
```

Default port is `3000` (override with `PORT=8080 npm start`).

---

## 📋 Feature Matrix

| Feature | Status | Description |
|---|---|---|
| **1-Click Instant Start** | ✅ Built | Zero wait time, instant room generation & media setup |
| **PWA Direct App Download** | ✅ Built | 1-click install as desktop/mobile app directly from website |
| **In-Call Recording** | ✅ Built | Native MediaRecorder screen+audio capture with `.webm` download |
| **Live Speech Captions** | ✅ Built | Real-time speech-to-text with speaker identification |
| **Collaborative Notes** | ✅ Built | Synced notepad in side panel with 1-click copy |
| **Mid-Call Device Switcher** | ✅ Built | Seamlessly swap mic, camera, and speaker during calls |
| **Picture-in-Picture (PiP)** | ✅ Built | Multitask with floating video tile |
| **Green Room Preview** | ✅ Built | Camera preview, mic meter, device selector, audio test |
| **HD Video & Dynamic Views** | ✅ Built | 720p ideal, Grid & Speaker layouts, video pinning |
| **Screen Sharing** | ✅ Built | Dedicated screen peer connection with filmstrip view |
| **In-Call Chat & Reactions** | ✅ Built | Live text chat, unread count, tile-anchored floating emoji |
| **Raise Hand Queue** | ✅ Built | Ordered hand-raise roster with notification chime |
| **Host Controls** | ✅ Built | Mute all, mute peer, remove peer, lower hands, end for all |
| **Host Key Recovery** | ✅ Built | Creator maintains host controls even if joining after guests |
| **Encrypted Peer-to-Peer** | ✅ Built | Direct WebRTC mesh for ultra-low latency & zero data relay |

---

## 🧪 Automated Test Suite

Convene includes end-to-end automated smoke tests covering signaling, media, and multi-client headless browser calls:

```bash
npm run typecheck     # TypeScript strict compilation check
npm run build         # Next.js production bundle build
npm run smoke:signal  # 30 signaling protocol & host security tests
npm run smoke:media   # Media stream, audio routing & track verification
npm run smoke:call    # Multi-client headless browser call (SDP, ICE, UI, video)
```

---

## 🌐 Production Deployment

Convene runs as **one persistent Node.js process** (Next.js + Socket.io signaling):

- **VPS / Docker / Railway / Render / Fly.io:** Deploy as a standard Node.js web service.
- **TURN Server (Optional):** STUN-only by default. To support highly restrictive corporate firewalls, pass `NEXT_PUBLIC_ICE_SERVERS`:
  ```bash
  NEXT_PUBLIC_ICE_SERVERS='[{"urls":["turn:turn.example.com:3478"],"username":"u","credential":"p"}]' npm run build
  ```

---

## 🔒 Security & Privacy

- **No Data Relay:** Audio and video streams travel directly between peers over DTLS-SRTP encryption.
- **In-Memory Ephemeral State:** Meeting rooms, chat messages, and notes exist only during the call lifecycle.
- **Zero Third-Party Telemetry:** No tracking, cookies, or third-party SDKs.
