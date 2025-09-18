// Test authentication script
// This helps debug the auth error

import { createClient } from '@/utils/supabase/client'

const testAuth = async () => {
  const supabase = createClient()
  
  try {
    console.log('Testing authentication...')
    
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    console.log('Current session:', session)
    console.log('Session error:', sessionError)
    
    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Current user:', user)
    console.log('User error:', userError)
    
    // Try to sign in with the test phone number
    console.log('Attempting to send OTP to 99135213...')
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: '99135213',
      options: {
        shouldCreateUser: false // Don't create new user, use existing
      }
    })
    
    console.log('OTP request result:', { data, error })
    
  } catch (err) {
    console.error('Test auth error:', err)
  }
}

testAuth()