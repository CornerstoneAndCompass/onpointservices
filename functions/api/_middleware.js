/* Auth guard for /api/* — runs before every API function.
   Public routes: auth/*, and POST /api/enquiry (the website contact form).
   Everything else requires a valid session. */
import { currentUser, json } from "./_utils.js";

const PUBLIC = new Set([
  "/api/auth/session",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/setup",
]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || url.pathname;

  // Always allow CORS preflight
  if (request.method === "OPTIONS") return next();

  const isPublic =
    PUBLIC.has(path) ||
    (path === "/api/enquiry" && request.method === "POST") || // public contact form
    (path === "/api/track" && request.method === "POST"); // analytics beacon from the website

  const user = await currentUser(env, request);
  context.data.user = user;

  if (isPublic) return next();
  if (!user) return json({ error: "Not authenticated" }, 401);
  return next();
}
