/**
 * Media regression smoke test: verifies the fixes for the adversarial QA
 * findings around remote audio and video attachment:
 *  - remote participants get a dedicated (unmuted-capable) <audio> element
 *    while their <video> stays muted (autoplay-safe, no self-echo)
 *  - camera off -> on reattaches srcObject to the remounted video element
 *  - pre-join -> meeting stream handoff keeps the self video live
 *  - screen share can be started, stopped, and started again
 *
 * Usage: node scripts/smoke-media.mjs   (exits 0 on pass, 1 on fail)
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3103;
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
  await page.goto(roomUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[placeholder="e.g. Aarav Sharma"]', { timeout: 20000 });
  await page.type('input[placeholder="e.g. Aarav Sharma"]', name);
  await page.waitForFunction(() => document.querySelector('video') !== null, {
    timeout: 20000,
    polling: 500,
  });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Join meeting'
    );
    if (!btn) throw new Error('Join button not found');
    btn.click();
  });
  await page.waitForFunction(
    () => window.__conveneDebug && window.__conveneDebug.status() === 'in-call',
    { timeout: 20000, polling: 500 }
  );
}

const clickByLabel = (page, label) =>
  page.evaluate((l) => {
    const btn = document.querySelector(`button[aria-label="${l}"]`);
    if (!btn) throw new Error(`button not found: ${l}`);
    btn.click();
  }, label);

async function main() {
  console.log(`[smoke:media] booting server on :${PORT}`);
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

    const roomUrl = `${BASE}/room/smoke-media-${Date.now()}`;
    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    const pageErrors = [];
    for (const [label, page] of [['A', pageA], ['B', pageB]]) {
      page.on('pageerror', (e) => pageErrors.push(`[${label}] pageerror: ${e.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') pageErrors.push(`[${label}] console.error: ${msg.text()}`);
      });
    }

    await joinAs(pageA, 'Alice', roomUrl);
    await joinAs(pageB, 'Bob', roomUrl);
    // Let signaling + negotiation settle.
    await pageA.waitForFunction(
      () => window.__conveneDebug && window.__conveneDebug.remoteCount() >= 1,
      { timeout: 20000, polling: 500 }
    );

    // 1. Remote audio: a dedicated <audio> element per remote participant,
    //    remote <video> stays muted (autoplay policy + no self-echo).
    const audioInfo = await pageA.evaluate(() => {
      const audios = [...document.querySelectorAll('audio')];
      const videos = [...document.querySelectorAll('video')];
      return {
        audioCount: audios.length,
        audioHasStream: audios.map((a) => !!a.srcObject),
        videosMuted: videos.map((v) => v.muted),
      };
    });
    check('remote participant gets a dedicated <audio> element', audioInfo.audioCount >= 1);
    check('remote <audio> has a stream attached', audioInfo.audioHasStream.every(Boolean));
    check('all <video> elements muted (autoplay-safe)', audioInfo.videosMuted.every(Boolean));

    // 2. Camera off -> on: remounted video element must get srcObject again.
    await clickByLabel(pageB, 'Turn camera off');
    await new Promise((r) => setTimeout(r, 800));
    const offOk = await pageB.evaluate(() => {
      const v = document.querySelector('video');
      return v !== null;
    });
    check('camera off keeps a video element mounted', offOk);
    await clickByLabel(pageB, 'Turn camera on');
    await pageB.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return v && v.srcObject && v.videoWidth > 0;
      },
      { timeout: 10000, polling: 300 }
    );
    const onOk = await pageB.evaluate(() => {
      const v = document.querySelector('video');
      return v && !!v.srcObject && v.videoWidth > 0;
    });
    check('camera on reattaches stream to video element', !!onOk);

    // 3. Pre-join -> meeting handoff: self video is live after join.
    const selfLive = await pageB.evaluate(() => {
      const v = document.querySelector('video');
      return v && !!v.srcObject && v.readyState >= 2;
    });
    check('pre-join stream handoff keeps self video live', !!selfLive);

    // 4. Screen share restart: mock the picker, share, stop, share again.
    await pageB.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      const fake = canvas.captureStream(5);
      // test-only mock: pretend the OS picker returned a stream
      navigator.mediaDevices.getDisplayMedia = async () => fake;
    });
    await clickByLabel(pageB, 'Share screen');
    await pageB.waitForFunction(
      () => document.querySelector('button[aria-label="Stop sharing screen"]') !== null,
      { timeout: 8000, polling: 300 }
    );
    check('screen share starts (mocked picker)', true);
    await clickByLabel(pageB, 'Stop sharing screen');
    await pageB.waitForFunction(
      () => document.querySelector('button[aria-label="Share screen"]') !== null,
      { timeout: 8000, polling: 300 }
    );
    check('screen share stops', true);
    await clickByLabel(pageB, 'Share screen');
    await pageB.waitForFunction(
      () => document.querySelector('button[aria-label="Stop sharing screen"]') !== null,
      { timeout: 8000, polling: 300 }
    );
    check('screen share starts AGAIN after stop (restart works)', true);

    check('no page errors or console errors', pageErrors.length === 0);
    if (pageErrors.length) console.error(pageErrors.join('\n'));
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }

  if (failures > 0) {
    console.error(`[smoke:media] ${failures} FAILURE(S)`);
    process.exit(1);
  }
  console.log('[smoke:media] ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('[smoke:media] ERROR:', err.message);
  process.exit(1);
});
