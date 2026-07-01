// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // anon биш!
Deno.serve(async (req)=>{
  const payload = await req.json();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data: dbUser, error: qErr } = await admin.from("users").select("id, phone, register_number").eq("phone", payload.user.phone).maybeSingle();
  const { user } = payload;
  if (user.user_metadata.register_number !== dbUser.register_number) {
    return new Response(JSON.stringify({
      error: {
        message: 'Бүртгэлийн мэдээлэл таарахгүй байна.',
        http_code: 400
      }
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  // if (dbUser?.id) {
  //   const { data: updated_data, error: error_update } = await admin.from('users').update({
  //     auth_user_id: user.id
  //   }).eq('id', dbUser.id).single();
  //   if (error_update) return new Response(JSON.stringify({
  //     error: {
  //       message: 'Бүртгэлийн мэдээлэл таарахгүй байна.',
  //       http_code: 400
  //     }
  //   }), {
  //     status: 400,
  //     headers: {
  //       'Content-Type': 'application/json'
  //     }
  //   });
  // }
  return new Response(JSON.stringify({}), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});
