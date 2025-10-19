export function detectMime(buf: Buffer): "audio/mpeg" | "audio/wav" {
  if (
    buf.slice(0, 4).toString("ascii") === "RIFF" &&
    buf.slice(8, 12).toString("ascii") === "WAVE"
  ) {
    return "audio/wav";
  }
  if (
    buf.slice(0, 3).toString("ascii") === "ID3" ||
    (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }
  return "audio/mpeg";
}

export function wavDurationMs(wav: Buffer): number {
  if (
    wav.slice(0, 4).toString("ascii") !== "RIFF" ||
    wav.slice(8, 12).toString("ascii") !== "WAVE"
  ) {
    throw new Error("Not a WAV file");
  }
  const numChannels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bitsPerSample = wav.readUInt16LE(34);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;

  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (id === "data") {
      const seconds = size / byteRate;
      return Math.round(seconds * 1000);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("No data chunk in WAV");
}

export function readUInt32BE(buf: Buffer, off: number): number {
  return (
    ((buf[off]! << 24) |
      (buf[off + 1]! << 16) |
      (buf[off + 2]! << 8) |
      buf[off + 3]!) >>>
    0
  );
}

export function skipID3v2(buf: Buffer): number {
  if (buf.length >= 10 && buf.slice(0, 3).toString("ascii") === "ID3") {
    const size =
      ((buf[6]! & 0x7f) << 21) |
      ((buf[7]! & 0x7f) << 14) |
      ((buf[8]! & 0x7f) << 7) |
      (buf[9]! & 0x7f);
    return 10 + size;
  }
  return 0;
}

type MpegHeader = {
  version: 1 | 2 | 25;
  layer: 1 | 2 | 3;
  bitrateKbps: number;
  sampleRate: number;
  padding: 0 | 1;
  channels: 1 | 2;
  samplesPerFrame: number;
  frameLengthBytes: number;
};

export function parseMpegHeaderAt(buf: Buffer, i: number): MpegHeader | null {
  if (i + 4 > buf.length) return null;
  const b1 = buf[i]!,
    b2 = buf[i + 1]!,
    b3 = buf[i + 2]!,
    b4 = buf[i + 3]!;
  if (b1 !== 0xff || (b2 & 0xe0) !== 0xe0) return null;

  const verBits = (b2 >> 3) & 0x03;
  const layerBits = (b2 >> 1) & 0x03;
  if (verBits === 1 || layerBits === 0) return null;

  const version = verBits === 3 ? 1 : verBits === 2 ? 2 : 25;
  const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3;

  const bitrateIdx = (b3 >> 4) & 0x0f;
  const sampleIdx = (b3 >> 2) & 0x03;
  const padding = ((b3 >> 1) & 0x01) as 0 | 1;

  const chanMode = (b4 >> 6) & 0x03;
  const channels = chanMode === 3 ? 1 : 2;

  const baseRates = [44100, 48000, 32000] as const;
  if (sampleIdx === 3) return null;
  let sampleRate = baseRates[sampleIdx]!;
  if (version === 2) sampleRate >>= 1;
  if (version === 25) sampleRate >>= 2;

  const br = {
    1: {
      1: [
        0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0,
      ],
      2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
      3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    },
    2: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    },
    25: {
      1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
      2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
      3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    },
  } as const;

  const bitrateKbps = br[version][layer][bitrateIdx]!;
  if (!bitrateKbps) return null;

  let samplesPerFrame: number;
  if (layer === 1) samplesPerFrame = 384;
  else if (layer === 2) samplesPerFrame = 1152;
  else samplesPerFrame = version === 1 ? 1152 : 576;

  let frameLengthBytes: number;
  if (layer === 1) {
    frameLengthBytes = Math.floor(
      ((12 * bitrateKbps * 1000) / sampleRate + padding) * 4
    );
  } else {
    const coef = version === 1 ? 144 : 72;
    frameLengthBytes = Math.floor(
      (coef * bitrateKbps * 1000) / sampleRate + padding
    );
  }

  if (frameLengthBytes < 24) return null;

  return {
    version,
    layer,
    bitrateKbps,
    sampleRate,
    padding,
    channels,
    samplesPerFrame,
    frameLengthBytes,
  };
}

export function tryXingVBRI(
  buf: Buffer,
  start: number,
  h: MpegHeader
): number | null {
  let sideInfoLen = 0;
  if (h.layer === 3) {
    if (h.version === 1) sideInfoLen = h.channels === 1 ? 17 : 32;
    else sideInfoLen = h.channels === 1 ? 9 : 17;
  }

  const xingOff = start + 4 + sideInfoLen;
  if (xingOff + 16 <= buf.length) {
    const tag = buf.slice(xingOff, xingOff + 4).toString("ascii");
    if (tag === "Xing" || "Info") {
      const flags = readUInt32BE(buf, xingOff + 4);
      if (flags & 0x0001) {
        const frames = readUInt32BE(buf, xingOff + 8);
        const seconds = (frames * h.samplesPerFrame) / h.sampleRate;
        return Math.round(seconds * 1000);
      }
    }
  }

  const vbriOff = start + 4 + 32;
  if (
    vbriOff + 26 <= buf.length &&
    buf.slice(vbriOff, vbriOff + 4).toString("ascii") === "VBRI"
  ) {
    const frames = readUInt32BE(buf, vbriOff + 14);
    const seconds = (frames * h.samplesPerFrame) / h.sampleRate;
    return Math.round(seconds * 1000);
  }
  return null;
}

export function mp3DurationMs(buf: Buffer): number {
  let i = skipID3v2(buf);
  while (i + 4 < buf.length) {
    const h = parseMpegHeaderAt(buf, i);
    if (h) {
      const vbrMs = tryXingVBRI(buf, i, h);
      if (vbrMs != null) return vbrMs;

      let totalSamples = 0,
        pos = i,
        safety = 0;
      while (pos + 4 <= buf.length && safety < 2_000_000) {
        const hh = parseMpegHeaderAt(buf, pos);
        if (!hh) break;
        totalSamples += hh.samplesPerFrame;
        pos += hh.frameLengthBytes;
        safety += 1;
      }
      const seconds = totalSamples / h.sampleRate;
      return Math.max(0, Math.round(seconds * 1000));
    }
    i++;
  }
  throw new Error("No MPEG frame found");
}

export async function getAudioDurationMs(
  buf: Buffer,
  mime?: string
): Promise<number> {
  if (mime === "audio/mpeg") return mp3DurationMs(buf);
  return wavDurationMs(buf);
}
