import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createAdvertisingGameBackendHandler } from "./handler.ts";

const environment: Readonly<Record<string, string | undefined>> = {
  SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  SUPABASE_SECRET_KEYS: Deno.env.get("SUPABASE_SECRET_KEYS"),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
};

Deno.serve(createAdvertisingGameBackendHandler({ environment }));
