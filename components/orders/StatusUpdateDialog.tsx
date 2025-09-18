'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { updateOrderStatus } from '@/actions/orders'

interface StatusUpdateDialogProps {
  orderId: number
  currentStatus: string
  userId: string
  onStatusUpdated?: () => void
  children: React.ReactNode
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]

export function StatusUpdateDialog({ 
  orderId, 
  currentStatus, 
  userId, 
  onStatusUpdated, 
  children 
}: StatusUpdateDialogProps) {
  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [comments, setComments] = useState('')
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!newStatus) {
      toast.error('Please select a new status')
      return
    }

    if (newStatus === currentStatus) {
      toast.error('Please select a different status')
      return
    }

    setIsLoading(true)
    
    try {
      const result = await updateOrderStatus(orderId, newStatus, userId, comments, reason)
      
      if (result.success) {
        toast.success('Order status updated successfully')
        setOpen(false)
        setNewStatus('')
        setComments('')
        setReason('')
        onStatusUpdated?.()
      } else {
        toast.error(result.error || 'Failed to update order status')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
          <DialogDescription>
            Change the status of this order and add optional comments.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions
                  .filter(option => option.value !== currentStatus)
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review_completed">Review Completed</SelectItem>
                <SelectItem value="requirements_met">Requirements Met</SelectItem>
                <SelectItem value="issue_resolved">Issue Resolved</SelectItem>
                <SelectItem value="parts_available">Parts Available</SelectItem>
                <SelectItem value="budget_approved">Budget Approved</SelectItem>
                <SelectItem value="manual_update">Manual Update</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="comments">Comments (Optional)</Label>
            <Textarea
              id="comments"
              placeholder="Add any additional comments about this status change..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isLoading || !newStatus}
          >
            {isLoading ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}