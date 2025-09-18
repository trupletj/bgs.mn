// Test script to verify the getOrdersByUser function
// Run this in the browser console

const testGetOrders = async () => {
  const testAuthUserId = '2f04b895-e3f2-4b10-af5e-444a1ef9c366' // The auth user ID
  
  try {
    console.log('Testing getOrdersByUser with auth user ID:', testAuthUserId)
    
    // This would normally be called by the OrdersList component
    const response = await fetch('/api/test-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authUserId: testAuthUserId })
    })
    
    const result = await response.json()
    console.log('Orders result:', result)
    
  } catch (err) {
    console.error('Test error:', err)
  }
}

// For manual testing in browser console
console.log('Run testGetOrders() to test the orders lookup')