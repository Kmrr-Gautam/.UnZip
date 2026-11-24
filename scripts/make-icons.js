const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a 256x256 valid PNG with a green gradient / icon
function createSimplePng(width, height) {
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = [0]; // filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      // Rounded icon shape with emerald green color
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < width / 2 - 8) {
        // Inner folder shape pattern
        const inFolder = (x > 40 && x < 216 && y > 60 && y < 200);
        if (inFolder) {
          row.push(0x34, 0xd3, 0x99, 0xff); // Light emerald
        } else {
          row.push(0x05, 0x96, 0x69, 0xff); // Darker emerald
        }
      } else {
        row.push(0x00, 0x00, 0x00, 0x00); // Transparent
      }
    }
    rawRows.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crc = crc32(Buffer.concat([typeBuf, data]));
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 helper
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c >>> 0;
}

const png = createSimplePng(256, 256);
const resourcesDir = path.join(__dirname, '..', 'resources');

fs.writeFileSync(path.join(resourcesDir, 'icon.png'), png);
console.log('Created 256x256 resources/icon.png');

// Create ICO containing the 256x256 PNG
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Icon type
icoHeader.writeUInt16LE(1, 4); // 1 image

const icoEntry = Buffer.alloc(16);
icoEntry[0] = 0; // width (0 means 256 in ICO spec)
icoEntry[1] = 0; // height (0 means 256 in ICO spec)
icoEntry[2] = 0;  // colors
icoEntry[3] = 0;  // reserved
icoEntry.writeUInt16LE(1, 4);  // color planes
icoEntry.writeUInt16LE(32, 6); // bpp
icoEntry.writeUInt32LE(png.length, 8); // size of image
icoEntry.writeUInt32LE(6 + 16, 12);   // offset

const ico = Buffer.concat([icoHeader, icoEntry, png]);
fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), ico);
console.log('Created 256x256 resources/icon.ico');
