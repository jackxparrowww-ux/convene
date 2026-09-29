import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPng(width, height, r, g, b, a = 255) {
  // 1 byte filter per line (0) + 4 bytes per pixel (RGBA)
  const lineSize = 1 + width * 4;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * lineSize;
    rawData[lineOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * 4;
      // Draw rounded card with Convene logo mark (#E5484D brand color)
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const radius = width * 0.44;
      
      const inBounds = dx < radius && dy < radius;
      if (inBounds) {
        // Dark background #0B0B0D with Convene red accent #E5484D
        const isBorder = (dx > radius - 12 || dy > radius - 12);
        const isCenterBar = (Math.abs(x - cx) < width * 0.05 && Math.abs(y - cy) < height * 0.28);
        const isLeftBar = (Math.abs(x - (cx - width * 0.16)) < width * 0.05 && Math.abs(y - cy) < height * 0.18);
        const isRightBar = (Math.abs(x - (cx + width * 0.16)) < width * 0.05 && Math.abs(y - cy) < height * 0.18);
        
        if (isBorder || isCenterBar || isLeftBar || isRightBar) {
          rawData[pxOffset] = 229;     // R #E5484D
          rawData[pxOffset + 1] = 72;  // G
          rawData[pxOffset + 2] = 77;  // B
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = 11;      // R #0B0B0D
          rawData[pxOffset + 1] = 11;  // G
          rawData[pxOffset + 2] = 13;  // B
          rawData[pxOffset + 3] = 255;
        }
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
      }
    }
    return ~c >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const toCrc = Buffer.concat([typeBuf, data]);
    const crcVal = crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression method
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace method

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512));
console.log('Generated icon-192.png and icon-512.png in public/');
