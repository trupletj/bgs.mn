'use server'

import type { PostgrestError } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/utils/supabase/supabaseAdmin'

export type Order = {
  id: number
  order_number: string
  title: string
  description?: string
  equipment_name?: string
  equipment_model?: string
  equipment_serial?: string
  equipment_location?: string
  urgency_level: 'low' | 'medium' | 'high' | 'critical'
  requested_delivery_date?: string
  total_estimated_cost: number
  currency: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
  notes?: string
}

export type OrderItem = {
  id: number
  order_id: number
  part_id?: number
  part_number?: string
  part_name: string
  part_description?: string
  manufacturer?: string
  quantity: number
  unit_price?: number
  total_price?: number
  currency: string
  status: string
  notes?: string
}

export type PartsCatalog = {
  id: number
  part_number: string
  name: string
  description?: string
  category?: string
  manufacturer?: string
  unit_price?: number
  currency: string
  availability_status: string
  lead_time_days?: number
  specifications?: any
}

export type WorkflowEntry = {
  id: number
  order_id: number
  from_status: string | null
  to_status: string
  changed_by: string
  change_reason: string | null
  comments: string | null
  created_at: string
  user?: {
    id: string
    nice_name?: string
    first_name?: string
    last_name?: string
    phone?: string
  }
}

export async function createOrder(orderData: Partial<Order>, authUserId: string): Promise<{
  data: Order | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  // First, find the user in public.users table that matches the auth user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()

  if (userError || !user) {
    return { 
      data: null, 
      error: { 
        message: 'User not found in users table. Please ensure your account is properly linked.',
        details: userError?.message || 'No matching user found',
        hint: 'Contact administrator to link your account',
        code: 'USER_NOT_LINKED'
      } as any
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      ...orderData,
      created_by: user.id, // Use the public.users.id instead of auth user ID
      status: 'draft'
    })
    .select()
    .single()

  return { data, error }
}

export async function getOrdersByUser(authUserId: string): Promise<{
  data: Order[]
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  // First, find the user in public.users table that matches the auth user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single()

  if (userError || !user) {
    return { 
      data: [], 
      error: { 
        message: 'User not found in users table. Please ensure your account is properly linked.',
        details: userError?.message || 'No matching user found',
        hint: 'Contact administrator to link your account',
        code: 'USER_NOT_LINKED'
      } as any
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('created_by', user.id) // Use the public.users.id
    .order('created_at', { ascending: false })

  return { data: data ?? [], error }
}

export async function getOrderById(orderId: number): Promise<{
  data: Order | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  return { data, error }
}

export async function getOrderWithDetails(orderId: number): Promise<{
  data: {
    order: Order
    items: OrderItem[]
    workflow: WorkflowEntry[]
    creator: { id: string; nice_name?: string; first_name?: string; last_name?: string; phone?: string }
  } | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError) {
      console.error('Order fetch error:', orderError)
      return { data: null, error: orderError }
    }

    if (!order) {
      return { data: null, error: { message: 'Order not found' } as PostgrestError }
    }

    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('id')

    // Don't fail if items fetch fails, just log and continue with empty array
    if (itemsError) {
      console.error('Order items fetch error:', itemsError)
    }

    // Get workflow history - make this optional
    let workflow: any[] = []
    try {
      const { data: workflowData, error: workflowError } = await supabase
        .from('order_workflow')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })

      if (workflowError) {
        console.error('Workflow fetch error:', workflowError)
        // Continue with empty workflow instead of failing
      } else {
        workflow = workflowData || []
      }
    } catch (workflowErr) {
      console.error('Workflow fetch exception:', workflowErr)
      // Continue with empty workflow
    }

    // Get creator details
    const { data: creator, error: creatorError } = await supabase
      .from('users')
      .select('id, nice_name, first_name, last_name, phone')
      .eq('id', order.created_by)
      .single()

    if (creatorError) {
      console.error('Creator fetch error:', creatorError)
      return { data: null, error: creatorError }
    }

    if (!creator) {
      return { data: null, error: { message: 'Creator not found' } as PostgrestError }
    }

    return {
      data: {
        order,
        items: items || [],
        workflow,
        creator
      },
      error: null
    }
  } catch (error) {
    console.error('Unexpected error in getOrderWithDetails:', error)
    return { data: null, error: error as PostgrestError }
  }
}

export async function getOrderItems(orderId: number): Promise<{
  data: OrderItem[]
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('id')

  return { data: data ?? [], error }
}

export async function addOrderItem(orderItem: Partial<OrderItem>): Promise<{
  data: OrderItem | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('order_items')
    .insert(orderItem)
    .select()
    .single()

  return { data, error }
}

export async function updateOrderItem(itemId: number, updates: Partial<OrderItem>): Promise<{
  data: OrderItem | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('order_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()

  return { data, error }
}

export async function deleteOrderItem(itemId: number): Promise<{
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('order_items')
    .delete()
    .eq('id', itemId)

  return { error }
}

export async function searchPartsCatalog(query: string, category?: string): Promise<{
  data: PartsCatalog[]
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  let queryBuilder = supabase
    .from('parts_catalog')
    .select('*')
    .eq('is_active', true)

  if (query) {
    queryBuilder = queryBuilder.or(`name.ilike.%${query}%,part_number.ilike.%${query}%,description.ilike.%${query}%`)
  }

  if (category) {
    queryBuilder = queryBuilder.eq('category', category)
  }

  const { data, error } = await queryBuilder
    .limit(50)
    .order('name')

  return { data: data ?? [], error }
}

export async function getPartsCategories(): Promise<{
  data: string[]
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('parts_catalog')
    .select('category')
    .not('category', 'is', null)
    .eq('is_active', true)

  const categories = [...new Set(data?.map(item => item.category).filter(Boolean))] as string[]
  
  return { data: categories, error }
}

export async function submitOrderForReview(orderId: number, userId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = getSupabaseAdmin()

  try {
    const { error } = await supabase.rpc('transition_order_status', {
      p_order_id: orderId,
      p_new_status: 'pending_review',
      p_user_id: userId,
      p_comments: 'Order submitted for technical review',
      p_change_reason: 'submission'
    })

    if (error) throw error

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function updateOrderStatus(
  orderId: number, 
  newStatus: string, 
  userId: string, 
  comments?: string,
  reason?: string
): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = getSupabaseAdmin()

  try {
    // First get the current status
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    // Update the order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateError) throw updateError

    // Log the status change in workflow
    const { error: workflowError } = await supabase
      .from('order_workflow')
      .insert({
        order_id: orderId,
        from_status: currentOrder.status,
        to_status: newStatus,
        changed_by: userId,
        change_reason: reason,
        comments: comments
      })

    if (workflowError) {
      console.error('Workflow log error:', workflowError)
      // Don't fail the entire operation if workflow logging fails
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('Status update error:', err)
    return { success: false, error: (err as Error).message }
  }
}

export async function updateOrder(orderId: number, updates: Partial<Order>): Promise<{
  data: Order | null
  error: PostgrestError | null
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('orders')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single()

  return { data, error }
}

export async function addOrderNote(orderId: number, note: string, userId: string): Promise<{
  success: boolean
  error: string | null
}> {
  const supabase = getSupabaseAdmin()

  try {
    // Add to workflow history as a note
    const { error } = await supabase
      .from('order_workflow')
      .insert({
        order_id: orderId,
        old_status: null,
        new_status: null,
        user_id: userId,
        comments: note,
        change_reason: 'note_added'
      })

    if (error) throw error

    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}