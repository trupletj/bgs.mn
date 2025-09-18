import { notFound } from 'next/navigation'
import { getOrderWithDetails } from '@/actions/orders'
import { OrderDetailView } from '@/components/orders/OrderDetailView'

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params
  
  // Convert string id to number
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) {
    notFound()
  }

  try {
    const { data: orderDetails, error } = await getOrderWithDetails(orderId)
    
    if (error) {
      console.error('Error fetching order details:', error)
      notFound()
    }
    
    if (!orderDetails) {
      console.error('No order details found for ID:', orderId)
      notFound()
    }

    return <OrderDetailView orderDetails={orderDetails} />
  } catch (error) {
    console.error('Unexpected error fetching order:', error)
    notFound()
  }
}