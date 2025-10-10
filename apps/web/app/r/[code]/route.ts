import { env } from "@/env";
import { createCaller, createContext } from "@workspace/trpc/server";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const REF_COOKIE = "ref";
const COOKIE_TTL_DAYS = 30;

function hmacSign(payload: string) {
  return crypto
    .createHmac("sha256", env.REFERRAL_COOKIE_SECRET)
    .update(payload)
    .digest("hex");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code;
  if (!code)
    return NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_BASE_URL));

  // Record click via tRPC server caller
  const caller = createCaller(await createContext());
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;
  const ipHash = ip
    ? crypto
        .createHash("sha256")
        .update(`${ip}:${ua || ""}:${env.REFERRAL_COOKIE_SECRET}`)
        .digest("hex")
    : undefined;
  try {
    await caller.referrals.recordClick({ code, ipHash, ua });
  } catch (e) {
    // swallow to avoid leaking code existence
  }

  // Set signed referral cookie
  const ts = Date.now();
  const payload = JSON.stringify({ code, ts });
  const sig = hmacSign(payload);
  const value = Buffer.from(JSON.stringify({ code, ts, sig })).toString(
    "base64url"
  );

  const res = NextResponse.redirect(new URL("/", env.NEXT_PUBLIC_BASE_URL));
  res.cookies.set(REF_COOKIE, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: COOKIE_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
