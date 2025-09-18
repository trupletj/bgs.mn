// Test script to verify the auth-hook function works
// Run this with: npx tsx test-auth-hook.ts

const testAuthHook = async () => {
  const response = await fetch('https://ljlywyhpxsutvrdeyyla.supabase.co/functions/v1/auth-hook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      type: 'INSERT',
      table: 'users',
      record: {
        id: 'test-user-id',
        phone: '99999999', // Test phone number
        created_at: new Date().toISOString()
      }
    })
  })

  const result = await response.json()
  console.log('Auth hook response:', result)
}

testAuthHook().catch(console.error)