/**
 * Convene — custom server: Next.js + Socket.io signaling in one process.
 *
 * Run:  npm run dev   (development, http://localhost:3000)
 *       npm run build && npm start   (production)
 *
 * The server keeps all meeting state in memory (rooms, participants, host).
 * Media itself is peer-to-peer WebRTC (mesh) — audio/video/screen streams
 * never pass through this server. Only signaling (offers/answers/ICE) and
 * lightweight control messages (chat, reactions, host commands) do.
 */

const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const path = require('path');
const next = require('next');
const { Server } = require('socket.io');

const isProdFlag = process.argv.includes('--production') || process.argv.includes('-p');
const hasBuild = fs.existsSync(path.join(__dirname, '.next'));
const dev = process.env.NODE_ENV === 'development'
  ? true
  : isProdFlag || process.env.NODE_ENV === 'production'
    ? false
    : !hasBuild;
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/**
 * rooms: roomId -> {
 *   hostId: string | null,
 *   participants: Map<socketId, Participant>
 * }
 * Participant = { id, name, audio, video, screen, hand, handRaisedAt, joinedAt }
 */
const rooms = new Map();

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = { hostId: null, participants: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function publicParticipant(p) {
  return {
    id: p.id,
    name: p.name,
    audio: p.audio,
    video: p.video,
    screen: p.screen,
    hand: p.hand,
    handRaisedAt: p.handRaisedAt,
    joinedAt: p.joinedAt,
  };
}

// Emoji allow-list for reactions (prevents abuse via arbitrary strings)
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '👏', '🎉', '😮', '🙏', '👋'];

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Never let Next.js handle Socket.io engine requests!
      if (req.url && req.url.startsWith('/socket.io/')) {
        return;
      }

      // Serve Service Worker with root scope and fresh cache headers
      if (req.url === '/sw.js') {
        const swPath = path.join(__dirname, 'public', 'sw.js');
        if (fs.existsSync(swPath)) {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Service-Worker-Allowed', '/');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          fs.createReadStream(swPath).pipe(res);
          return;
        }
      }

      // Baseline security headers on every response.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "media-src 'self' blob:; " +
          "font-src 'self' data:; " +
          "worker-src 'self' blob:; " +
          "manifest-src 'self'; " +
          "connect-src 'self' ws: wss: https:;"
      );
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[convene] request handler error', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  const io = new Server(server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
  });

  // Simple per-socket rate limits: { event: { count, resetAt } }.
  const MAX_ROOM_SIZE = 16;

  io.on('connection', (socket) => {
    let currentRoom = null;

    const roomOf = () => (currentRoom ? rooms.get(currentRoom) : null);
    const isHost = () => {
      const room = roomOf();
      return !!room && room.hostId === socket.id;
    };
    // True only when this socket is on the roster of its current room.
    // Gates every room-scoped event so ejected/stale sockets can't act.
    const inRoom = () => {
      const room = roomOf();
      return !!room && !!currentRoom && room.participants.has(socket.id);
    };

    // Per-socket leaky rate limiter. Returns true when the event must be dropped.
    const buckets = new Map();
    const throttled = (key, max, windowMs) => {
      const now = Date.now();
      let b = buckets.get(key);
      if (!b || now >= b.resetAt) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      return b.count > max;
    };

    // ---- Join / leave -------------------------------------------------
    socket.on('join-room', ({ roomId, name, hostKey }) => {
      if (typeof roomId !== 'string' || !roomId.trim()) return;
      const id = roomId.trim().slice(0, 64);
      if (currentRoom && currentRoom !== id) leaveRoom();

      const room = getRoom(id);
      if (room.participants.size >= MAX_ROOM_SIZE) {
        socket.emit('room-full');
        return;
      }
      const cleanName =
        String(name || 'Guest').trim().slice(0, 40) || 'Guest';
      const key = typeof hostKey === 'string' ? hostKey.slice(0, 64) : '';

      const participant = {
        id: socket.id,
        name: cleanName,
        audio: true,
        video: true,
        screen: false,
        hand: false,
        handRaisedAt: 0,
        joinedAt: Date.now(),
      };
      room.participants.set(socket.id, participant);
      // Host rule: the meeting creator holds the host key (minted by the
      // landing page and kept in the creator's URL hash — never shared in
      // invite links). Presenting it claims host, even from a later join.
      // Rooms created without a key fall back to first-joiner-wins.
      if (key && !room.hostKey) room.hostKey = key;
      if (!room.hostId || (key && room.hostKey && key === room.hostKey)) {
        const changed = room.hostId !== socket.id;
        room.hostId = socket.id;
        if (changed) io.to(id).emit('host-changed', { hostId: socket.id });
      }

      socket.join(id);
      currentRoom = id;

      socket.emit('room-state', {
        participants: [...room.participants.values()].map(publicParticipant),
        hostId: room.hostId,
      });
      socket
        .to(id)
        .emit('user-joined', {
          participant: publicParticipant(participant),
          hostId: room.hostId,
        });
      console.log(`[convene] participant ${socket.id} (${cleanName}) joined room ${id} (${room.participants.size} active)`);
    });

    function leaveRoom() {
      if (!currentRoom) return;
      const roomId = currentRoom;
      const room = rooms.get(roomId);
      // Only announce when the socket was actually on the roster — a socket
      // ejected via remove-peer was already announced, so a later
      // disconnect must not double-broadcast.
      const wasParticipant = room ? room.participants.has(socket.id) : false;
      if (room) {
        room.participants.delete(socket.id);
        if (wasParticipant)
          socket.to(roomId).emit('user-left', { id: socket.id });
        if (room.hostId === socket.id) {
          // Promote the earliest joiner to host so meetings survive host drops.
          const next = [...room.participants.values()].sort(
            (a, b) => a.joinedAt - b.joinedAt
          )[0];
          room.hostId = next ? next.id : null;
          if (next) io.to(roomId).emit('host-changed', { hostId: next.id });
        }
        if (room.participants.size === 0) rooms.delete(roomId);
      }
      socket.leave(roomId);
      currentRoom = null;
    }

    socket.on('leave-room', leaveRoom);
    socket.on('disconnect', leaveRoom);

    // ---- WebRTC signaling relay ---------------------------------------
    // { to, kind: 'media' | 'screen', type: 'offer' | 'answer' | 'ice', payload }
    socket.on('signal', ({ to, kind, type, payload }) => {
      if (!to || !inRoom()) return;
      if (kind !== 'media' && kind !== 'screen') return;
      if (type !== 'offer' && type !== 'answer' && type !== 'ice') return;
      // Never relay into another room: the recipient must be on this roster.
      if (!roomOf().participants.has(to)) return;
      if (throttled('signal', 60, 10000)) return;
      io.to(to).emit('signal', { from: socket.id, kind, type, payload });
    });

    // ---- Media / presence state ---------------------------------------
    socket.on('media-state', (state) => {
      const room = roomOf();
      if (!room || !inRoom()) return;
      const p = room.participants.get(socket.id);
      if (!p) return;
      if (typeof state.audio === 'boolean') p.audio = state.audio;
      if (typeof state.video === 'boolean') p.video = state.video;
      if (typeof state.screen === 'boolean') p.screen = state.screen;
      if (typeof state.hand === 'boolean') {
        p.hand = state.hand;
        p.handRaisedAt = state.hand ? Date.now() : 0;
      }
      socket
        .to(currentRoom)
        .emit('peer-state', { participant: publicParticipant(p) });
    });

    // ---- Chat ----------------------------------------------------------
    socket.on('chat-message', ({ text }) => {
      const room = roomOf();
      if (!room || !inRoom()) return;
      if (throttled('chat', 8, 10000)) return;
      const clean = String(text || '').slice(0, 1000);
      if (!clean.trim()) return;
      const p = room.participants.get(socket.id);
      io.to(currentRoom).emit('chat-message', {
        id: `${Date.now()}-${socket.id}`,
        from: socket.id,
        name: p ? p.name : 'Guest',
        text: clean,
        ts: Date.now(),
      });
    });

    // ---- Reactions ------------------------------------------------------
    socket.on('reaction', ({ emoji }) => {
      const room = roomOf();
      if (!room || !inRoom()) return;
      if (!ALLOWED_REACTIONS.includes(emoji)) return;
      if (throttled('reaction', 12, 10000)) return;
      const p = room.participants.get(socket.id);
      // Exclude the sender: they already render it optimistically.
      socket.to(currentRoom).emit('reaction', {
        id: `${Date.now()}-${socket.id}-${Math.random().toString(36).slice(2, 8)}`,
        from: socket.id,
        name: p ? p.name : 'Guest',
        emoji,
      });
    });

    // ---- Live Captions --------------------------------------------------
    socket.on('caption', ({ text }) => {
      const room = roomOf();
      if (!room || !inRoom()) return;
      const clean = String(text || '').slice(0, 500);
      if (!clean.trim()) return;
      const p = room.participants.get(socket.id);
      socket.to(currentRoom).emit('caption', {
        id: `${Date.now()}-${socket.id}`,
        from: socket.id,
        name: p ? p.name : 'Guest',
        text: clean,
        ts: Date.now(),
      });
    });

    // ---- Collaborative Notes --------------------------------------------
    socket.on('notes-update', ({ text }) => {
      const room = roomOf();
      if (!room || !inRoom()) return;
      const clean = String(text || '').slice(0, 10000);
      room.notes = clean;
      socket.to(currentRoom).emit('notes-update', { text: clean });
    });

    // ---- Host controls ---------------------------------------------------
    socket.on('mute-all', () => {
      if (!isHost() || !currentRoom) return;
      socket.to(currentRoom).emit('force-mute');
    });

    socket.on('mute-peer', ({ targetId }) => {
      if (!isHost() || !currentRoom) return;
      if (!targetId || targetId === socket.id) return;
      // The target must be in the host's own room — never another room.
      if (!roomOf().participants.has(targetId)) return;
      io.to(targetId).emit('force-mute');
    });

    socket.on('lower-hand', ({ targetId }) => {
      const room = roomOf();
      if (!room || !currentRoom) return;
      const target = targetId || socket.id;
      if (target !== socket.id && !isHost()) return;
      const p = room.participants.get(target);
      if (!p || !p.hand) return;
      p.hand = false;
      p.handRaisedAt = 0;
      io.to(currentRoom).emit('peer-state', { participant: publicParticipant(p) });
    });

    socket.on('lower-all-hands', () => {
      const room = roomOf();
      if (!room || !currentRoom || !isHost()) return;
      for (const p of room.participants.values()) {
        if (p.hand) {
          p.hand = false;
          p.handRaisedAt = 0;
          io.to(currentRoom).emit('peer-state', {
            participant: publicParticipant(p),
          });
        }
      }
    });

    socket.on('remove-peer', ({ targetId }) => {
      if (!isHost() || !currentRoom) return;
      if (!targetId || targetId === socket.id) return;
      const room = rooms.get(currentRoom);
      // Only a participant of THIS room can be removed — never a socket from
      // another room.
      if (!room || !room.participants.has(targetId)) return;
      const target = io.sockets.sockets.get(targetId);

      room.participants.delete(targetId);
      if (room.participants.size === 0) rooms.delete(currentRoom);
      if (target) {
        target.leave(currentRoom);
        target.emit('removed');
        // Drop the socket: a removed client must not keep a live connection
        // it can speak through (its room events are also gated by inRoom()).
        // Rejoining needs a fresh connection, i.e. opening the link again.
        target.disconnect(true);
      }
      // The target already left the Socket.io room, so this reaches only the
      // remaining participants.
      io.to(currentRoom).emit('user-left', { id: targetId });
    });

    socket.on('end-meeting', () => {
      if (!isHost() || !currentRoom) return;
      const roomId = currentRoom;
      io.to(roomId).emit('meeting-ended');
      rooms.delete(roomId);
    });
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Convene ready on http://${hostname}:${port}`);
  });
});
