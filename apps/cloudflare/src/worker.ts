/// <reference types="@cloudflare/workers-types" />
import type { R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  AUDIO: R2Bucket; // [[r2_buckets]] binding
  ALLOW_ORIGIN?: string; // e.g. "https://instantaudio.online http://localhost:3000"
}

/** Coerce to BodyInit to sidestep stream type clashes in mixed repos */
const asBody = (b: unknown): BodyInit => b as any;

function parseAllowed(envValue?: string) {
  if (!envValue) return null;
  return envValue
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Strict, Range-friendly CORS (reflects a single allowed origin) */
function makeCors(originFromReq: string | null, env: Env) {
  const allowed = parseAllowed(env.ALLOW_ORIGIN);

  // Decide the single value (or omit header if not allowed)
  let allowOriginValue: string | null = null;
  if (!allowed || allowed.length === 0) {
    // No allow-list provided: reflect request origin if present, else wildcard
    allowOriginValue = originFromReq ?? "*";
  } else if (allowed.includes("*")) {
    allowOriginValue = "*";
  } else if (originFromReq && allowed.includes(originFromReq)) {
    allowOriginValue = originFromReq; // reflect exact match
  } else {
    allowOriginValue = null; // not allowed -> no ACAO header
  }

  const h = new Headers();
  if (allowOriginValue) h.set("Access-Control-Allow-Origin", allowOriginValue);
  h.set("Vary", "Origin");
  h.set("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS");
  h.set(
    "Access-Control-Allow-Headers",
    "Range, If-Range, If-None-Match, If-Modified-Since, Content-Type"
  );
  h.set(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified"
  );
  h.set("Access-Control-Max-Age", "86400");
  h.set("Timing-Allow-Origin", "*");
  h.set("Cross-Origin-Resource-Policy", "cross-origin");
  return h;
}

/** Parse single byte range per RFC 7233 */
function parseRange(
  h: string | null,
  size: number
): { start: number; end: number; length: number } | null {
  if (!h) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(h.trim());
  if (!m) return null;

  const s = m[1],
    e = m[2];

  if ((s ?? "") === "" && (e ?? "") !== "") {
    const suffix = Number(e);
    if (!Number.isFinite(suffix) || suffix <= 0 || size === 0) return null;
    const length = Math.min(suffix, size);
    const start = size - length;
    const end = size - 1;
    return { start, end, length };
  }

  const start = Number(s);
  if (!Number.isFinite(start) || start < 0 || start >= size) return null;

  let end = (e ?? "") === "" ? size - 1 : Number(e);
  if (!Number.isFinite(end) || end < start) return null;

  end = Math.min(end, size - 1);
  return { start, end, length: end - start + 1 };
}

/** If-Range: only honor Range if tag/date matches */
function ifRangeAllowsRange(req: Request, etag: string, lastModified: string) {
  const ir = req.headers.get("If-Range");
  if (!ir) return true;
  if (ir.startsWith('W/"') || ir.startsWith('"')) return ir === etag;
  const irDate = Date.parse(ir);
  const lmDate = Date.parse(lastModified);
  if (Number.isFinite(irDate) && Number.isFinite(lmDate))
    return irDate >= lmDate;
  return true;
}

const CONTENT_TYPES: Record<"mp3" | "m4a", string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const baseCors = makeCors(origin, env);

    // Expect: /audio/<fileId>.(mp3|m4a)
    const m = url.pathname.match(/^\/audio\/([^\/]+)\.(mp3|m4a)$/);
    if (!m) {
      return new Response("Bad Request", { status: 400, headers: baseCors });
    }

    if (req.method === "OPTIONS") {
      // If client asked for specific headers, reflect them (plus ours)
      const reqHdrs = req.headers.get("Access-Control-Request-Headers");
      if (reqHdrs) {
        const set = new Set(
          (
            "Range, If-Range, If-None-Match, If-Modified-Since, Content-Type," +
            reqHdrs
          )
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
        baseCors.set(
          "Access-Control-Allow-Headers",
          Array.from(set).join(", ")
        );
      }
      return new Response(null, { status: 204, headers: baseCors });
    }

    const fileId = decodeURIComponent(m[1]!);
    const ext = m[2] as "mp3" | "m4a";

    // Look for the final stitched file at audio/<fileId>.<ext>
    const audioKey = `audio/${fileId}.${ext}`;
    const audioObject = await env.AUDIO.get(audioKey);

    if (!audioObject) {
      return new Response("Not Found", { status: 404, headers: baseCors });
    }

    const size = audioObject.size;
    const lastModified = audioObject.uploaded.toUTCString();
    const etag = audioObject.etag || `"${audioObject.key}-${size}"`;

    // Common headers
    const h = new Headers(baseCors);
    h.set("Accept-Ranges", "bytes");
    h.set("Content-Type", CONTENT_TYPES[ext]);
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    h.set("ETag", etag);
    h.set("Last-Modified", lastModified);

    const rangeHdr = req.headers.get("Range");
    const wantsRange = !!rangeHdr;
    const allowRange = ifRangeAllowsRange(req, etag, lastModified);
    const parsed = wantsRange && allowRange ? parseRange(rangeHdr, size) : null;

    // HEAD
    if (req.method === "HEAD") {
      if (wantsRange && allowRange) {
        if (!parsed) {
          h.set("Content-Range", `bytes */${size}`);
          return new Response(null, { status: 416, headers: h });
        }
        h.set("Content-Range", `bytes ${parsed.start}-${parsed.end}/${size}`);
        h.set("Content-Length", String(parsed.length));
        return new Response(null, { status: 206, headers: h });
      }
      h.set("Content-Length", String(size));
      return new Response(null, { status: 200, headers: h });
    }

    if (req.method !== "GET") {
      h.set("Allow", "GET,HEAD,OPTIONS");
      return new Response("Method Not Allowed", { status: 405, headers: h });
    }

    // GET with valid Range
    if (parsed) {
      const rangeObject = await env.AUDIO.get(audioKey, {
        range: { offset: parsed.start, length: parsed.length },
      });

      if (!rangeObject?.body) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: h,
        });
      }

      h.set("Content-Range", `bytes ${parsed.start}-${parsed.end}/${size}`);
      h.set("Content-Length", String(parsed.length));
      return new Response(asBody(rangeObject.body), {
        status: 206,
        headers: h,
      });
    }

    // GET full content
    h.set("Content-Length", String(size));
    return new Response(asBody(audioObject.body), { status: 200, headers: h });
  },
};
