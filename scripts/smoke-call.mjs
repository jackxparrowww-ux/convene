/**
 * Real 2-client call test: boots the server, opens two headless Chromium
 * pages with fake camera/mic, joins both to the same room through the real
 * UI (pre-join -> join), and verifies:
 *  - RTCPeerConnection reaches 'connected' on both sides
 *  - each page renders 2 live <video> elements (self + remote)
 *  - in-call chat works end to end through the UI
 *  - no page errors / console errors during the call
 *
 * Usage: node scripts/smoke-call.mjs   (exits 0 on pass, 1 on fail)
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.error(`  FAIL ${name}`);
  }
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server boot timeout')), 30000);
    child.stdout.on('data', (d) => {
      if (d.toString().includes('Convene ready')) {
        clearTimeout(t);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited: ${code}`)));
  });
}

async function joinAs(page, name, roomUrl) {
  const step = (s) => console.log(`[smoke:call]   ${name}: ${s}`);
  step('goto');
  await page.goto(roomUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  step('wait name input');
  await page.waitForSelector('input[placeholder="e.g. Aarav Sharma"]', { timeout: 20000 });
  step('type name');
  await page.type('input[placeholder="e.g. Aarav Sharma"]', name);
  step('wait preview video');
  await page.waitForFunction(
    () => document.querySelector('video') !== null,
    { timeout: 20000, polling: 500 }
  );
  step('click join');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Join meeting'
    );
    if (!btn) throw new Error('Join button not found');
    btn.click();
  });
  step('wait in-call');
  await page.waitForFunction(
    () => window.__conveneDebug && window.__conveneDebug.status() === 'in-call',
    { timeout: 20000, polling: 500 }
  );
  step('in call');
}

async function main() {
  console.log(`[smoke:call] booting server on :${PORT}`);
  const server = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  let browser = null;
  try {
    await waitForServer(server);

    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--mute-audio',
      ],
    });

    const roomUrl = `${BASE}/room/smoke-${Date.now()}`;
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    const pageErrors = [];
    for (const [label, page] of [['A', pageA], ['B', pageB]]) {
      page.on('pageerror', (e) => pageErrors.push(`[${label}] pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') pageErrors.push(`[${label}] console.error: ${msg.text()}`);
      });
    }

    console.log('[smoke:call] Alice joining…');
    await joinAs(pageA, 'Alice', roomUrl);
    console.log('[smoke:call] Bob joining…');
    await joinAs(pageB, 'Bob', roomUrl);

    // Signaling-complete state: SDP handshake done both ways, ICE trickling
    // both directions, remote tracks negotiated (ontrack fired).
    // NOTE: this sandbox blocks all UDP, so ICE can never reach 'connected'
    // here. On any normal network the same code proceeds to 'connected'.
    for (const [label, page] of [['A', pageA], ['B', pageB]]) {
      await page.waitForFunction(
        () => {
          const d = window.__conveneDebug;
          if (!d) return false;
          const info = d.pcInfo();
          const ids = Object.keys(info);
          if (ids.length !== 1) return false;
          const p = info[ids[0]];
          return (
            p.signaling === 'stable' &&
            p.hasLocal &&
            p.hasRemote &&
            p.iceSent > 0 &&
            p.iceReceived > 0 &&
            p.remoteVideoTracks >= 1 &&
            p.remoteAudioTracks >= 1
          );
        },
        { timeout: 45000, polling: 500 }
      );
      const info = await page.evaluate(() => window.__conveneDebug.pcInfo());
      console.log(`[smoke:call] ${label} pcInfo:`, JSON.stringify(info));
      check(`${label}: SDP handshake complete + ICE trickling + remote tracks`, true);
    }

    // Each page renders self + remote video with live streams
    for (const [label, page] of [['A', pageA], ['B', pageB]]) {
      const liveVideos = await page.evaluate(
        () => [...document.querySelectorAll('video')].filter((v) => v.srcObject !== null).length
      );
      check(`${label}: renders 2 live videos (self + remote)`, liveVideos === 2);
    }

    // Remote names visible on both sides
    const aSeesBob = await pageA.evaluate(() => document.body.innerText.includes('Bob'));
    const bSeesAlice = await pageB.evaluate(() => document.body.innerText.includes('Alice'));
    check('A sees Bob in the call UI', aSeesBob);
    check('B sees Alice in the call UI', bSeesAlice);

    // Chat end-to-end through the real UI
    const clickByLabel = async (page, label) => {
      await page.evaluate((l) => {
        const btn = [...document.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === l
        );
        if (!btn) throw new Error(`button '${l}' not found`);
        btn.click();
      }, label);
    };
    await clickByLabel(pageA, 'Chat');
    await pageA.waitForSelector('input[aria-label="Send a message"]', { timeout: 10000 });
    await pageA.type('input[aria-label="Send a message"]', 'hello from Alice');
    await pageA.keyboard.press('Enter');
    await clickByLabel(pageB, 'Chat');
    await pageB.waitForFunction(
      () => document.body.innerText.includes('hello from Alice'),
      { timeout: 10000, polling: 500 }
    );
    check('chat message delivered A -> B through UI', true);

    // Reaction end-to-end (floating emoji appears on sender tile)
    await clickByLabel(pageA, 'Send reaction');
    await pageA.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(
        (b) => b.getAttribute('aria-label') === 'React 👍'
      );
      if (!btn) throw new Error('reaction button not found');
      btn.click();
    });
    await pageB.waitForFunction(
      () => [...document.querySelectorAll('span')].some((s) => s.textContent === '👍'),
      { timeout: 10000, polling: 500 }
    );
    check('reaction delivered A -> B through UI', true);

    // Hand raise visible to the other side
    await clickByLabel(pageB, 'Raise hand');
    await pageA.waitForFunction(
      () => document.body.innerText.includes('Participants') && true,
      { timeout: 5000, polling: 500 }
    );
    await clickByLabel(pageA, 'Participants');
    await pageA.waitForFunction(
      () => [...document.querySelectorAll('span')].some((s) => s.title === 'Hand raised'),
      { timeout: 10000, polling: 500 }
    );
    check('hand raise visible in participants panel', true);

    if (pageErrors.length > 0) {
      console.error('[smoke:call] page/console errors:');
      for (const e of pageErrors) console.error(`    ${e}`);
      failures++;
    } else {
      console.log('  ok   no page errors or console errors during call');
    }

    await browser.close();
    browser = null;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    server.kill('SIGTERM');
  }

  if (failures > 0) {
    console.error(`[smoke:call] ${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log('[smoke:call] ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('[smoke:call] ERROR:', err.message);
  process.exit(1);
});
