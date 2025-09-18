'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

import { 
  ClockIcon, 
  PlusIcon, 
  TrashIcon, 
  SearchIcon, 
  SettingsIcon,
  PackageIcon,
  FileTextIcon,
  InfoIcon,
  CalendarIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { createOrder, addOrderItem, searchPartsCatalog, getPartsCategories, type PartsCatalog } from '@/actions/orders'
import { createClient } from '@/utils/supabase/client'

interface OrderFormData {
  title: string
  description: string
  equipment_name: string
  equipment_model: string
  equipment_serial: string
  equipment_location: string
  urgency_level: 'low' | 'medium' | 'high' | 'critical'
  requested_delivery_date: string
  notes: string
}

interface OrderItemForm {
  part_id?: number
  part_number?: string
  part_name: string
  part_description?: string
  manufacturer?: string
  quantity: number
  unit_price?: number
  notes?: string
}

export function OrderCreationForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PartsCatalog[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  const [formData, setFormData] = useState<OrderFormData>({
    title: '',
    description: '',
    equipment_name: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_location: '',
    urgency_level: 'medium',
    requested_delivery_date: '',
    notes: ''
  })

  const [orderItems, setOrderItems] = useState<OrderItemForm[]>([
    {
      part_name: '',
      quantity: 1,
      unit_price: 0
    }
  ])

  useEffect(() => {
    // Get current user
    const getUser = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Auth error:', error)
          // If there's an auth error, user is not authenticated
          setUser(null)
          return
        }
        
        console.log('User data:', user)
        setUser(user)
      } catch (err) {
        console.error('Error getting user:', err)
        setUser(null)
      }
    }
    getUser()

    // Load categories
    const loadCategories = async () => {
      try {
        const { data, error } = await getPartsCategories()
        console.log('Categories data:', data, 'Error:', error)
        if (data) setCategories(data)
      } catch (err) {
        console.error('Error loading categories:', err)
      }
    }
    loadCategories()

    // Set loading to false after initial load
    setTimeout(() => setInitialLoading(false), 100)
  }, [])

  const handleInputChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleItemChange = (index: number, field: keyof OrderItemForm, value: string | number | undefined) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
  }

  const addNewItem = () => {
    setOrderItems(prev => [...prev, {
      part_name: '',
      quantity: 1,
      unit_price: 0
    }])
  }

  const removeItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const searchParts = async () => {
    if (!searchQuery.trim()) return
    
    const categoryFilter = selectedCategory === 'all' ? undefined : selectedCategory
    const { data, error } = await searchPartsCatalog(searchQuery, categoryFilter)
    if (error) {
      toast.error('Failed to search parts: ' + error.message)
    } else {
      setSearchResults(data)
    }
  }

  const selectPart = (part: PartsCatalog, itemIndex: number) => {
    handleItemChange(itemIndex, 'part_id', part.id)
    handleItemChange(itemIndex, 'part_number', part.part_number)
    handleItemChange(itemIndex, 'part_name', part.name)
    handleItemChange(itemIndex, 'part_description', part.description)
    handleItemChange(itemIndex, 'manufacturer', part.manufacturer)
    handleItemChange(itemIndex, 'unit_price', part.unit_price || 0)
    setSearchResults([])
    setSearchQuery('')
  }

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      return total + (item.quantity * (item.unit_price || 0))
    }, 0)
  }

  const handleSubmit = async (isDraft: boolean = false) => {
    if (!user) {
      toast.error('You must be logged in to create an order')
      return
    }

    if (!formData.title.trim()) {
      toast.error('Order title is required')
      return
    }

    if (orderItems.some(item => !item.part_name.trim())) {
      toast.error('All order items must have a part name')
      return
    }

    setLoading(true)

    try {
      // Create order
      const { data: order, error: orderError } = await createOrder({
        title: formData.title,
        description: formData.description,
        equipment_name: formData.equipment_name,
        equipment_model: formData.equipment_model,
        equipment_serial: formData.equipment_serial,
        equipment_location: formData.equipment_location,
        urgency_level: formData.urgency_level,
        requested_delivery_date: formData.requested_delivery_date || undefined,
        notes: formData.notes,
        total_estimated_cost: calculateTotal()
      }, user.id)

      if (orderError || !order) {
        throw new Error(orderError?.message || 'Failed to create order')
      }

      // Add order items
      for (const item of orderItems) {
        const { error: itemError } = await addOrderItem({
          order_id: order.id,
          part_id: item.part_id,
          part_number: item.part_number,
          part_name: item.part_name,
          part_description: item.part_description,
          manufacturer: item.manufacturer,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes
        })

        if (itemError) {
          throw new Error(`Failed to add item: ${itemError.message}`)
        }
      }

      toast.success(`Order ${order.order_number} created successfully${isDraft ? ' as draft' : ''}`)
      router.push(`/orders/${order.id}`)

    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="animate-pulse">
          <div className="bg-gray-200 h-24 rounded-lg mb-6"></div>
          <div className="space-y-6">
            <div className="bg-gray-200 h-48 rounded-lg"></div>
            <div className="bg-gray-200 h-48 rounded-lg"></div>
            <div className="bg-gray-200 h-96 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  // Show authentication required message if no user
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-yellow-100 rounded-full p-3">
              <InfoIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800">Authentication Required</h3>
              <p className="text-yellow-700 mt-2">
                You need to be logged in to create an order. Please sign in with your phone number.
              </p>
              <p className="text-sm text-yellow-600 mt-1">
                For testing: Use register number + phone &ldquo;99135213&rdquo;
              </p>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => router.push('/')}
                variant="outline"
                className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
              >
                Go to Login
              </Button>
              <Button 
                onClick={() => router.refresh()}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Refresh Page
              </Button>
              <Button 
                onClick={() => {
                  // Temporary test mode - simulate user for testing
                  setUser({ id: '2f04b895-e3f2-4b10-af5e-444a1ef9c366' } as { id: string })
                  toast.info('Test mode activated - Using test user')
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Test Mode (Dev Only)
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Progress Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <PackageIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Equipment Parts Order</h2>
            <p className="text-gray-600">Fill out the details below to create your parts requisition</p>
          </div>
        </div>
      </div>

      {/* Order Information */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <InfoIcon className="h-5 w-5 text-indigo-600"/>
            <span>Order Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                Order Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Brake System Maintenance Parts"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urgency" className="text-sm font-medium text-gray-700">Urgency Level</Label>
              <Select value={formData.urgency_level} onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => handleInputChange('urgency_level', value)}>
                <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="flex items-center">
                    <Badge variant="secondary" className="bg-green-100 text-green-800 mr-2">Low</Badge>
                    Standard timeline
                  </SelectItem>
                  <SelectItem value="medium" className="flex items-center">
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 mr-2">Medium</Badge>
                    Moderate priority
                  </SelectItem>
                  <SelectItem value="high" className="flex items-center">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 mr-2">High</Badge>
                    Expedited processing
                  </SelectItem>
                  <SelectItem value="critical" className="flex items-center">
                    <Badge variant="secondary" className="bg-red-100 text-red-800 mr-2">Critical</Badge>
                    Emergency priority
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('description', e.target.value)}
              placeholder="Detailed description of the order requirements..."
              rows={4}
              className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery_date" className="text-sm font-medium text-gray-700 flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4" />
              <span>Requested Delivery Date</span>
            </Label>
            <Input
              id="delivery_date"
              type="date"
              value={formData.requested_delivery_date}
              onChange={(e) => handleInputChange('requested_delivery_date', e.target.value)}
              className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Equipment Information */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <SettingsIcon className="h-5 w-5 text-indigo-600" />
            <span>Equipment Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="equipment_name" className="text-sm font-medium text-gray-700">Equipment Name</Label>
              <Input
                id="equipment_name"
                value={formData.equipment_name}
                onChange={(e) => handleInputChange('equipment_name', e.target.value)}
                placeholder="e.g., Excavator, Truck, Generator"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment_model" className="text-sm font-medium text-gray-700">Model</Label>
              <Input
                id="equipment_model"
                value={formData.equipment_model}
                onChange={(e) => handleInputChange('equipment_model', e.target.value)}
                placeholder="e.g., CAT 320D, Volvo FH16"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="equipment_serial" className="text-sm font-medium text-gray-700">Serial Number</Label>
              <Input
                id="equipment_serial"
                value={formData.equipment_serial}
                onChange={(e) => handleInputChange('equipment_serial', e.target.value)}
                placeholder="Equipment serial number"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equipment_location" className="text-sm font-medium text-gray-700">Location</Label>
              <Input
                id="equipment_location"
                value={formData.equipment_location}
                onChange={(e) => handleInputChange('equipment_location', e.target.value)}
                placeholder="e.g., Mine Site A, Workshop 2"
                className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Parts Required
            <Button type="button" onClick={addNewItem} size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Part
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Parts Search */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search parts catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchParts()}
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={searchParts}>
              <SearchIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
              <h4 className="font-medium mb-2">Search Results:</h4>
              <div className="space-y-2">
                {searchResults.map(part => (
                  <div key={part.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex-1">
                      <div className="font-medium">{part.name}</div>
                      <div className="text-sm text-gray-600">
                        {part.part_number} • {part.manufacturer} • ₮{part.unit_price?.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {orderItems.map((_, index) => (
                        <Button
                          key={index}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => selectPart(part, index)}
                        >
                          Add to Item {index + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-4">
            {orderItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Part {index + 1}</h4>
                  {orderItems.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>Part Name *</Label>
                    <Input
                      value={item.part_name}
                      onChange={(e) => handleItemChange(index, 'part_name', e.target.value)}
                      placeholder="Part name or description"
                    />
                  </div>
                  <div>
                    <Label>Part Number</Label>
                    <Input
                      value={item.part_number || ''}
                      onChange={(e) => handleItemChange(index, 'part_number', e.target.value)}
                      placeholder="Manufacturer part number"
                    />
                  </div>
                  <div>
                    <Label>Manufacturer</Label>
                    <Input
                      value={item.manufacturer || ''}
                      onChange={(e) => handleItemChange(index, 'manufacturer', e.target.value)}
                      placeholder="Brand/Manufacturer"
                    />
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label>Unit Price (₮)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price || ''}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Total: ₮{((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}</Label>
                  </div>
                </div>

                {item.part_description && (
                  <div className="mt-2">
                    <Label>Description</Label>
                    <p className="text-sm text-gray-600">{item.part_description}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between items-center font-semibold text-lg">
            <span>Total Estimated Cost:</span>
            <span>₮{calculateTotal().toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card className="shadow-sm border-0 ring-1 ring-gray-200">
        <CardHeader className="bg-gray-50/50 border-b border-gray-200">
          <CardTitle className="flex items-center space-x-2">
            <FileTextIcon className="h-5 w-5 text-green-600" />
            <span>Additional Notes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
              Special instructions, delivery requirements, or additional details
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Enter any special instructions, delivery requirements, installation notes, or other relevant information..."
              className="min-h-[120px] border-gray-300 focus:border-blue-500 focus:ring-blue-500 resize-none"
              rows={5}
            />
            <p className="text-xs text-gray-500">
              This information will be visible to approvers and the procurement team.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 -mx-6 -mb-6">
        <div className="flex flex-col sm:flex-row gap-3 justify-end max-w-md ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="h-11 px-6 border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="h-11 px-6 bg-gray-100 text-gray-800 hover:bg-gray-200"
          >
            {loading ? (
              <>
                <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save as Draft'
            )}
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {loading ? (
              <>
                <ClockIcon className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Submit for Review'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}