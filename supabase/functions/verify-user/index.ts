import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS толгой мэдээллийг тогтмол болгож тодорхойлох
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // 1. OPTIONS хүсэлтийг (Preflight) шууд 200 OK буцаах
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { phone, register } = await req.json();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const normalizedRegister = register.toUpperCase().trim();

    const { data: dbUser, error: qErr } = await admin
      .from("users") 
      .select("id, phone, register_number")
      .eq("phone", phone)
      .ilike("register_number", normalizedRegister)
      .maybeSingle();

    if (qErr) throw qErr;

    if (!dbUser) {
      return new Response(
        JSON.stringify({ error: "Бүртгэлтэй хэрэглэгч олдсонгүй эсвэл регистр буруу байна." }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ message: "Success" }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});