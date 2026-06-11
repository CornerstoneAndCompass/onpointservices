/* Public image delivery from the R2 media bucket. GET /media/<key> */
export async function onRequestGet(context) {
  const { env, params } = context;
  const obj = await env.MEDIA.get(params.key);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}
