// Supabase Edge Function: turns text into gte-small embeddings (384 numbers each).
// Deploy with: supabase functions deploy embed
// Called by the app and the seed script with the service-role key as a Bearer token.
/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

const session = new Supabase.ai.Session("gte-small");

Deno.serve(async (req) => {
  const body = await req.json().catch(() => null);
  const inputs: unknown = body?.inputs;
  if (
    !Array.isArray(inputs) || inputs.length === 0 || inputs.length > 32 ||
    !inputs.every((s) => typeof s === "string" && s.length > 0 && s.length <= 8000)
  ) {
    return Response.json({ error: "inputs must be 1 to 32 non-empty strings (max 8000 characters)." }, { status: 400 });
  }
  const embeddings = await Promise.all(
    inputs.map(async (text: string) => Array.from(await session.run(text, { mean_pool: true, normalize: true }) as ArrayLike<number>)),
  );
  return Response.json({ model: "gte-small", embeddings });
});
