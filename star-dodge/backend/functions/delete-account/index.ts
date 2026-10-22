// Supabase Edge Function. Admin credentials remain on the server.
import { createClient } from "npm:@supabase/supabase-js@2";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers,
    });
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer "))
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers,
    });
  const url = Deno.env.get("SUPABASE_URL")!,
    publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers,
    });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const result = await admin.auth.admin.deleteUser(user.id);
  return new Response(
    JSON.stringify(
      result.error ? { error: "deletion_failed" } : { deleted: true },
    ),
    { status: result.error ? 500 : 200, headers },
  );
});
