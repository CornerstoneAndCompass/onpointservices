/* ============================================================
   On Point CMS — shared backend utilities
   Cloudflare Pages Functions. Bindings: DB (D1), MEDIA (R2),
   SESSION_SECRET (secret).
   ============================================================ */

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export const err = (message, status = 400) => json({ error: message }, status);

/* ---------- password hashing (PBKDF2-SHA256) ----------
   Stored format: "iterations:saltHex:hashHex"  */
const ITER = 100000;

const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
};

async function pbkdf2(password, salt, iterations, bits = 256, hashAlg = "SHA-256") {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const out = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: hashAlg },
    key,
    bits
  );
  return new Uint8Array(out);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITER);
  return `${ITER}:${toHex(salt)}:${toHex(hash)}`;
}

const eq = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

export async function verifyPassword(password, stored) {
  try {
    const [iterStr, saltHex, hashHex] = String(stored).split(":");
    const iterations = parseInt(iterStr, 10);
    if (!iterations || !saltHex || !hashHex) return false;
    const salt = fromHex(saltHex);
    const want = fromHex(hashHex);
    const bits = want.length * 8;
    // Try SHA-256 first (our scheme), then SHA-512 in case the original
    // CMS used it — covers existing accounts either way.
    for (const alg of ["SHA-256", "SHA-512"]) {
      const got = await pbkdf2(password, salt, iterations, bits, alg);
      if (eq(got, want)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* ---------- signed session cookie ----------
   Cookie value: base64url(JSON{uid,exp}).hmacHex  */
const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(str);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
};

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

const SECRET = (env) => env.SESSION_SECRET || "onpoint-dev-secret-change-me";
const COOKIE = "op_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function createSession(env, user) {
  const payload = b64url(
    new TextEncoder().encode(JSON.stringify({ uid: user.id, exp: Date.now() + MAX_AGE * 1000 }))
  );
  const sig = await hmac(SECRET(env), payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`;
}

export const clearSession = () =>
  `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export async function readSession(env, request) {
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(COOKIE + "=([^;]+)"));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(SECRET(env), payload);
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    if (!data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function currentUser(env, request) {
  const uid = await readSession(env, request);
  if (!uid) return null;
  return env.DB.prepare("SELECT id, email, name, role FROM users WHERE id = ?")
    .bind(uid)
    .first();
}

/* ---------- misc ---------- */
export function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
