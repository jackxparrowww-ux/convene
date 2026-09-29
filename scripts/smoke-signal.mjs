/**
 * Signaling smoke test: boots the real server and drives two raw
 * socket.io clients through the full control protocol.
 *
 * Covers: join-room, room-state, user-joined, offer/answer/ICE relay,
 * chat, reactions, media-state/peer-state, raise hand, host mute-all
 * (incl. non-host rejection), remove-peer, end-meeting.
 *
 * Usage: node scripts/smoke-signal.mjs   (exits 0 on pass, 1 on fail)
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { io } from 'socket.io-client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3101;
const URL = `http://localhost:${PORT}`;
const ROOM = `smoke-${Date.now()}`;

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

function once(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timeout waiting for '${event}'`));
    }, timeoutMs);
    const handler = (data) => {
      clearTimeout(t);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server boot timeout')), 30000);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('Convene ready')) {
        clearTimeout(t);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited: ${code}`)));
  });
}

async function main() {
  console.log(`[smoke:signal] booting server on :${PORT}`);
  const server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  try {
    await waitForServer(server);
    console.log('[smoke:signal] server up');

    const A = io(URL, { transports: ['websocket'] });
    const B = io(URL, { transports: ['websocket'] });
    await Promise.all([once(A, 'connect'), once(B, 'connect')]);
    check('both clients connect', A.connected && B.connected);

    // A creates the room (becomes host)
    A.emit('join-room', { roomId: ROOM, name: 'Alice' });
    const stateA = await once(A, 'room-state');
    check('A gets room-state with 1 participant', stateA.participants.length === 1);
    check('A is host', stateA.hostId === A.id);

    // B joins
    const joinedP = once(A, 'user-joined');
    B.emit('join-room', { roomId: ROOM, name: 'Bob' });
    const stateB = await once(B, 'room-state');
    const joined = await joinedP;
    check('B gets room-state with 2 participants', stateB.participants.length === 2);
    check('A sees user-joined for Bob', joined.participant.name === 'Bob');
    check('host unchanged after B joins', stateB.hostId === A.id);

    // Offer / answer / ICE relay
    const offerP = once(B, 'signal');
    A.emit('signal', { to: B.id, kind: 'media', type: 'offer', payload: { type: 'offer', sdp: 'fake-offer' } });
    const offer = await offerP;
    check('offer relayed A->B', offer.from === A.id && offer.type === 'offer' && offer.kind === 'media');

    const answerP = once(A, 'signal');
    B.emit('signal', { to: A.id, kind: 'media', type: 'answer', payload: { type: 'answer', sdp: 'fake-answer' } });
    const answer = await answerP;
    check('answer relayed B->A', answer.from === B.id && answer.type === 'answer');

    const iceP = once(B, 'signal');
    A.emit('signal', { to: A.id === A.id ? B.id : A.id, kind: 'media', type: 'ice', payload: { candidate: 'fake' } });
    const ice = await iceP;
    check('ICE relayed A->B', ice.from === A.id && ice.type === 'ice');

    // Screen-kind relay is separate from media
    const screenP = once(B, 'signal');
    A.emit('signal', { to: B.id, kind: 'screen', type: 'offer', payload: { type: 'offer', sdp: 'x' } });
    const scr = await screenP;
    check('screen offer relayed with kind=screen', scr.kind === 'screen');

    // Chat
    const chatP = once(B, 'chat-message');
    A.emit('chat-message', { text: 'hello from Alice' });
    const chat = await chatP;
    check('chat relayed with name+text', chat.name === 'Alice' && chat.text === 'hello from Alice');

    // Empty chat rejected
    let gotEmpty = false;
    B.once('chat-message', () => { gotEmpty = true; });
    A.emit('chat-message', { text: '   ' });
    await new Promise((r) => setTimeout(r, 400));
    check('empty chat message dropped', !gotEmpty);

    // Reaction (allow-listed)
    const reactP = once(A, 'reaction');
    B.emit('reaction', { emoji: '👍' });
    const react = await reactP;
    check('reaction relayed', react.emoji === '👍' && react.from === B.id);

    // Reaction not on allow-list dropped
    let gotBad = false;
    A.once('reaction', () => { gotBad = true; });
    B.emit('reaction', { emoji: 'not-an-emoji' });
    await new Promise((r) => setTimeout(r, 400));
    check('non-allowlisted reaction dropped', !gotBad);

    // Raise hand -> peer-state
    const handP = once(A, 'peer-state');
    B.emit('media-state', { hand: true });
    const handState = await handP;
    check('raise hand broadcasts peer-state', handState.participant.hand === true && handState.participant.id === B.id);

    // Host mute-all: non-host attempt must NOT mute
    let forceMuted = false;
    A.once('force-mute', () => { forceMuted = true; });
    B.emit('mute-all'); // Bob is not host
    await new Promise((r) => setTimeout(r, 400));
    check('non-host mute-all ignored', !forceMuted);

    const fmP = once(B, 'force-mute');
    A.emit('mute-all'); // Alice is host
    await fmP;
    check('host mute-all reaches peers', true);

    // Host lowers Bob's hand
    const lowerP = once(A, 'peer-state');
    A.emit('lower-hand', { targetId: B.id });
    const lowered = await lowerP;
    check('host can lower hand', lowered.participant.hand === false);

    // Host removes Bob: target is notified, ejected from the roster,
    // and its socket is dropped so it can't keep speaking into the room.
    const removedP = once(B, 'removed');
    const ejectedP = once(A, 'user-left');
    const discP = once(B, 'disconnect');
    A.emit('remove-peer', { targetId: B.id });
    await removedP;
    check('remove-peer notifies target', true);
    const ejected = await ejectedP;
    check('remove-peer ejects target from roster', ejected.id === B.id);
    await discP;
    check('removed socket is disconnected', B.connected === false);

    // The room stays healthy: a fresh client can join with the same link.
    const C = io(URL);
    await once(C, 'connect');
    C.emit('join-room', { roomId: ROOM, name: 'Carol' });
    const rs = await once(C, 'room-state');
    check(
      'room stays joinable after removal',
      rs.participants.some((p) => p.id === C.id)
    );

    const leftP = once(A, 'user-left');
    C.emit('leave-room');
    const left = await leftP;
    check('leave broadcasts user-left', left.id === C.id);

    // Carol rejoins, then host ends meeting for all
    C.emit('join-room', { roomId: ROOM, name: 'Carol' });
    await once(C, 'room-state');
    const endedP = once(C, 'meeting-ended');
    A.emit('end-meeting');
    await endedP;
    check('end-meeting broadcasts meeting-ended', true);

    // Cross-room injection: Eve hosts a different room and tries to reach
    // Alice (in ROOM). Both mute-peer and signal must stay room-local.
    const E = io(URL);
    await once(E, 'connect');
    E.emit('join-room', { roomId: `smoke2-${Date.now()}`, name: 'Eve' });
    await once(E, 'room-state');
    let crossMute = false;
    A.once('force-mute', () => { crossMute = true; });
    E.emit('mute-peer', { targetId: A.id });
    await new Promise((r) => setTimeout(r, 500));
    check('cross-room mute-peer blocked', !crossMute);
    let crossSignal = false;
    A.once('signal', () => { crossSignal = true; });
    E.emit('signal', { to: A.id, kind: 'media', type: 'offer', payload: {} });
    await new Promise((r) => setTimeout(r, 500));
    check('cross-room signal blocked', !crossSignal);
    E.disconnect();

    // Host key: a guest who enters first does not permanently steal host
    // from the creator, who can claim it later with the key from their
    // URL hash — and a wrong key cannot take host.
    const R2 = `smoke-host-${Date.now()}`;
    const G = io(URL); // guest enters first, no key
    await once(G, 'connect');
    G.emit('join-room', { roomId: R2, name: 'Guest' });
    const gState = await once(G, 'room-state');
    check('guest first becomes tentative host', gState.hostId === G.id);

    const hostChangedP = once(G, 'host-changed');
    const joinedP2 = once(G, 'user-joined');
    const C2 = io(URL);
    await once(C2, 'connect');
    C2.emit('join-room', { roomId: R2, name: 'Creator', hostKey: 'creator-secret-key' });
    const cState = await once(C2, 'room-state');
    await joinedP2;
    const hc = await hostChangedP;
    check('creator claims host with key', cState.hostId === C2.id);
    check('guest sees host transfer', hc.hostId === C2.id);

    const W = io(URL);
    await once(W, 'connect');
    W.emit('join-room', { roomId: R2, name: 'Intruder', hostKey: 'wrong-key' });
    const wState = await once(W, 'room-state');
    check('wrong host key cannot steal host', wState.hostId === C2.id);

    // Creator leaves and rejoins with the same key: host returns to them.
    C2.disconnect();
    await new Promise((r) => setTimeout(r, 600));
    const C3 = io(URL);
    await once(C3, 'connect');
    C3.emit('join-room', { roomId: R2, name: 'Creator', hostKey: 'creator-secret-key' });
    const c3State = await once(C3, 'room-state');
    check('creator reclaims host on rejoin', c3State.hostId === C3.id);
    G.disconnect();
    W.disconnect();
    C3.disconnect();

    A.disconnect();
    B.disconnect();
    C.disconnect();
  } finally {
    server.kill('SIGTERM');
  }

  if (failures > 0) {
    console.error(`[smoke:signal] ${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log('[smoke:signal] ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('[smoke:signal] ERROR:', err.message);
  process.exit(1);
});
