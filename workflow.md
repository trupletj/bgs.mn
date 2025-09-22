

## Project Overview
Create a comprehensive equipment parts order management system using Supabase + Next.js with RBAC (Role-Based Access Control). This system manages the complete workflow from order creation to procurement completion.

## System Requirements

### 1. Database Schema Setup
Create the following tables in Supabase:

**Core Tables:**
- `orders` - Main order information with status workflow
- `order_items` - Individual parts in each order  
- `parts_catalog` - Master catalog of available parts
- `order_workflow` - Audit trail of status changes
- `order_reviewers` - Assigned reviewers for each order
- `order_revisions` - Change history tracking

**RBAC Tables:** (if not already implemented)
- `roles` - System roles
- `permissions` - Available permissions  
- `role_permissions` - Role-permission mappings

### 2. Required Roles and Permissions

**Roles:**
- `parts_requester` - Can create and submit orders
- `technical_reviewer` - Reviews orders and suggests changes
- `department_approver` - Approves orders at department level
- `final_approver` - Final approval authority
- `procurement_officer` - Handles purchasing and order completion

**Key Permissions:**
- `orders.create`, `orders.read`, `orders.update`, `orders.delete`
- `orders.submit`, `orders.review`, `orders.approve`
- `orders.final_approve`, `orders.procure`

### 3. Order Status Workflow
Implement this exact workflow sequence:
1. `draft` → User creates order /  Эхний ээлжинд захиалга хийх хүн 
2. `pending_review` → Submitted for technical review
3. `in_review` → Technical reviewers make changes 
4. `pending_approval` → Ready for department approval
5. `approved` → Department approved, needs final approval
6. `pending_final_approval`
7. `final_approved` → Final approval completed
8. `in_procurement` → Procurement officer handling purchase
9. `completed` → All purchases completed
10. `rejected`/`cancelled` - Terminal states

### 4. Key Features to Implement

**Order Creation Page:**
- Form with equipment details (name, model, serial number, location)
- Dynamic parts selection from catalog
- Parts search functionality
- Quantity, pricing, and urgency settings
- Total cost calculation
- Save as draft or submit for review

**Review/Approval Interface:**
- Display order details and current status
- Comment system for feedback
- Ability to request changes or approve
- Status transition buttons based on user role
- Revision history tracking

**Dashboard Views:**
- Orders requiring my action (based on user role)
- Orders I've created
- Orders by status
- Search and filter capabilities

**Workflow Management:**
- Automatic status progression
- Email/notification system (optional)
- Audit logging for all changes
- Role-based access to different workflow stages

### 5. Security Implementation

**Row Level Security (RLS):**
- Users can only see orders they created OR are assigned to review
- Privileged roles (admin, final_approver) can see all orders
- Status transitions restricted by role permissions

**API Security:**
- Server-side permission validation
- Protected API routes with RBAC middleware
- Input validation and sanitization

### 6. Technical Implementation Guidelines

**Frontend (Next.js):**
- Use React hooks for order management
- Implement protected routes and components
- Create reusable RBAC components (PermissionGate, RoleGate)
- Form validation and error handling
- Responsive design for mobile/desktop

**Backend (Supabase):**
- Database functions for workflow transitions
- RLS policies for data access control  
- Triggers for automatic status updates
- Indexes for performance optimization

**Real-time Features:**
- Supabase subscriptions for order updates
- Live status changes across users
- Notification system integration

### 7. Implementation Steps

1. **Database Setup:**
   - Create all required tables with proper relationships
   - Set up RBAC tables and initial data
   - Configure RLS policies
   - Create utility functions for workflow management

2. **Authentication & Authorization:**
   - Set up Supabase Auth integration
   - Create RBAC hooks and utilities
   - Implement protected routes and components

3. **Core Features:**
   - Order creation interface
   - Parts catalog management
   - Review/approval workflows
   - Dashboard and listing pages

4. **Advanced Features:**
   - Search and filtering
   - Audit trail display
   - Bulk operations
   - Reporting and analytics

5. **Testing & Optimization:**
   - Test all workflow scenarios
   - Verify RBAC restrictions
   - Performance optimization
   - Error handling

### 8. Sample Code Structure

```
/pages
  /api
    /orders
      index.ts (CRUD operations)
      [id].ts (individual order management)
      /[id]
        approve.ts
        review.ts
        workflow.ts
  /orders
    index.tsx (orders list)
    create.tsx (order creation)
    [id].tsx (order details)
    
/components
  /orders
    OrderForm.tsx
    OrderList.tsx
    OrderDetails.tsx
    ReviewPanel.tsx
    WorkflowStatus.tsx
  /auth
    ProtectedRoute.tsx
    RoleGate.tsx
    PermissionGate.tsx

/hooks
  useOrders.ts
  useOrderWorkflow.ts
  useRBAC.ts
  usePartsCatalog.ts

/lib
  supabase.ts
  rbac.ts
  types.ts
```

### 9. Success Criteria

The system should:
- ✅ Allow role-based order creation and management
- ✅ Enforce proper workflow progression
- ✅ Maintain complete audit trail
- ✅ Provide real-time updates across users
- ✅ Be secure with proper RBAC implementation
- ✅ Handle all edge cases and error scenarios
- ✅ Be scalable and performant

### 10. Additional Considerations

- **Data Validation:** Implement comprehensive validation on both client and server
- **Error Handling:** Graceful error handling with user-friendly messages
- **Performance:** Optimize queries and implement caching where appropriate
- **Accessibility:** Ensure the interface is accessible (WCAG compliance)
- **Mobile Responsiveness:** Works well on all device sizes
- **Internationalization:** Support for Mongolian language interface

## Implementation Priority
Focus on core workflow functionality first, then add advanced features. Ensure security and RBAC are implemented from the beginning, not added later.

Start with the database schema and RBAC setup, then build the order creation flow, followed by the review/approval interfaces.