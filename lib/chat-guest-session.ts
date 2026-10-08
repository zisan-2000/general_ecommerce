import "server-only";

import { randomBytes } from "node:crypto";
import { decode, encode } from "next-auth/jwt";
import { type NextRequest, NextResponse } from "next/server";

// Separate encryption context: a NextAuth login token cannot become a chat token.
const SESSION_SALT = "support-chat-guest-session-v1";
const SESSION_PURPOSE = "support-chat-guest";
export const GUEST_CHAT_SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const COOKIE_NAME = process.env.NODE_ENV === "production"
  ? "__Host-support-chat-guest"
  : "support-chat-guest";

declare const verifiedSession: unique symbol;
export type VerifiedGuestChatSession = {
  readonly conversationId: string;
  readonly expiresAt: number;
  readonly [verifiedSession]: true;
};

export function requireGuestChatSessionSecret(): string {
  const secret = process.env.SUPPORT_CHAT_SESSION_SECRET
    || process.env.NEXTAUTH_SECRET
    || process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error("Guest chat requires a server-only session secret of at least 32 characters.");
  }
  return secret;
}

export async function readGuestChatSession(
  request: NextRequest,
): Promise<VerifiedGuestChatSession | null> {
  // Never accept a token from JSON, a URL, or email.
  const cookies = request.cookies.getAll(COOKIE_NAME);
  if (cookies.length !== 1 || !cookies[0].value || cookies[0].value.length > 4096) return null;
  const secret = requireGuestChatSessionSecret();
  try {
    const payload = await decode({ token: cookies[0].value, secret, salt: SESSION_SALT });
    const now = Math.floor(Date.now() / 1000);
    if (
      !payload || payload.purpose !== SESSION_PURPOSE || payload.version !== 1
      || typeof payload.conversationId !== "string" || !payload.conversationId
      || payload.conversationId.length > 128
      || typeof payload.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(payload.nonce)
      || typeof payload.iat !== "number" || !Number.isSafeInteger(payload.iat)
      || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp)
      || payload.iat > now || payload.exp <= now || payload.exp <= payload.iat
      // NextAuth computes iat/exp separately; allow a one-second minting boundary,
      // but still enforce an absolute lifetime of seven days from iat below.
      || payload.exp - payload.iat > GUEST_CHAT_SESSION_MAX_AGE + 1
      || now >= payload.iat + GUEST_CHAT_SESSION_MAX_AGE
    ) return null;
    return {
      conversationId: payload.conversationId,
      expiresAt: Math.min(payload.exp, payload.iat + GUEST_CHAT_SESSION_MAX_AGE),
    } as VerifiedGuestChatSession;
  } catch {
    // Do not log bearer credentials or decoder errors containing them.
    return null;
  }
}

export async function setGuestChatSession(
  response: NextResponse,
  conversationId: string,
): Promise<void> {
  const token = await encode({
    secret: requireGuestChatSessionSecret(),
    salt: SESSION_SALT,
    maxAge: GUEST_CHAT_SESSION_MAX_AGE,
    token: {
      purpose: SESSION_PURPOSE,
      version: 1,
      conversationId,
      nonce: randomBytes(32).toString("base64url"),
    },
  });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: GUEST_CHAT_SESSION_MAX_AGE,
    // No Domain: production __Host- cookies cannot be set by a sibling host.
  });
}

export function chatJson(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  return NextResponse.json(body, { ...init, headers });
}

export function rejectUnsafeChatMutation(request: NextRequest): NextResponse | null {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const origin = request.headers.get("origin");
  let trustedOrigin = false;
  if (origin) {
    const allowedOrigins = [new URL(request.url).origin];
    // Support deployments behind a reverse proxy without trusting forwarded headers.
    if (process.env.NEXTAUTH_URL) {
      try {
        allowedOrigins.push(new URL(process.env.NEXTAUTH_URL).origin);
      } catch {
        // Ignore invalid configuration; do not trust an arbitrary Origin.
      }
    }
    trustedOrigin = allowedOrigins.includes(origin);
  } else {
    trustedOrigin = fetchSite === "same-origin";
  }
  if (!trustedOrigin || fetchSite === "cross-site") {
    return chatJson({ error: "Untrusted chat request origin." }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return chatJson({ error: "Chat requests must use application/json." }, { status: 415 });
  }
  return null;
}

export function rejectUnownedGuestChat(
  actor: { isAdmin: boolean; userId: string | null },
  session: VerifiedGuestChatSession | null,
  conversationId: string,
): NextResponse | null {
  if (actor.isAdmin || actor.userId) return null;
  if (!session) {
    return chatJson(
      { error: "A valid guest chat session is required.", code: "GUEST_CHAT_SESSION_REQUIRED" },
      { status: 401 },
    );
  }
  if (session.conversationId !== conversationId) {
    return chatJson({ error: "Forbidden." }, { status: 403 });
  }
  return null;
}
