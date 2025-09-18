import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { type, table, record, old_record } = await req.json()

    // Only handle auth.users inserts (new user signup)
    if (type === 'INSERT' && table === 'users' && record.phone) {
      const authUserId = record.id
      const phone = record.phone

      // Find matching user in public.users table by phone
      const { data: publicUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('id, register_number, phone, first_name, last_name')
        .eq('phone', phone)
        .single()

      if (!findError && publicUser) {
        // Link the auth user to public user
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ auth_user_id: authUserId })
          .eq('id', publicUser.id)

        if (updateError) {
          console.error('Failed to link users:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to link user accounts' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('Successfully linked auth user to public user:', {
          authUserId,
          publicUserId: publicUser.id,
          phone
        })

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User accounts linked successfully',
            publicUserId: publicUser.id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        console.log('No matching public user found for phone:', phone)
        return new Response(
          JSON.stringify({ 
            error: 'No matching user found in directory',
            details: 'Phone number not found in user directory'
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ message: 'Hook processed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Auth hook error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})