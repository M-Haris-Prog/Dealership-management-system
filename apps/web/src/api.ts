export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  isActive: boolean
  roles: string[]
  permissions: string[]
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  user: AuthenticatedUser
}

export type SalesResource = 'customers' | 'vehicles' | 'leads' | 'bookings'

export interface SalesCustomer {
  id: string
  customerCode?: string
  name: string
  company?: string
  email: string
  phone: string
  status: 'Active' | 'Prospect' | 'At risk'
  lastActivity: string
}

export interface SalesVehicle {
  id: string
  name: string
  stockNumber: string
  price: string
  status: 'Available' | 'Reserved' | 'Allocated' | 'Sold'
  age: string
}

export interface SalesLead {
  id: string
  name: string
  interest: string
  source: string
  owner: string
  status: 'New' | 'Contacted' | 'Qualified'
  created: string
}

export interface SalesBooking {
  id: string
  customer: string
  vehicle: string
  date: string
  time: string
  status: 'Reserved' | 'Confirmed' | 'Invoiced' | 'Delivered' | 'Completed' | 'Cancelled' | 'Pending'
}

export interface SalesData {
  customers: SalesCustomer[]
  vehicles: SalesVehicle[]
  leads: SalesLead[]
  bookings: SalesBooking[]
}

// Keep production deployments same-origin while allowing local Vite to proxy the API.
// VITE_API_URL can still point at a separately hosted API when required.
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const body = await response.json() as { message?: string | string[] }
      if (body.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message
    } catch {
      // Keep the friendly fallback when the API does not return JSON.
    }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function login(identifier: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export function getCurrentUser(token: string): Promise<AuthenticatedUser> {
  return request<AuthenticatedUser>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getSalesResource<T>(token: string, resource: SalesResource): Promise<T[]> {
  return request<T[]>(`/sales/${resource}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export interface CreateVehicleInput {
  make: string
  model: string
  modelYear?: number
  registrationNo: string
  vin?: string
  color?: string
  price?: number
  salePrice?: number
  customerId?: string
}

export function createVehicle(token: string, body: CreateVehicleInput, branchId?: string) {
  return request<SalesVehicle>(`/sales/vehicles${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export interface CreateCustomerInput {
  name: string
  phone: string
  email?: string
  address?: string
  cnic?: string
  sourceType?: string
  sourceId?: string
}

export function createCustomer(token: string, body: CreateCustomerInput, branchId?: string) {
  return request<SalesCustomer>(`/sales/customers${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export interface CreateLeadInput {
  name: string
  phone: string
  email?: string
  interest?: string
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST'
  customerId?: string
  ownerId?: string
}

export function createLead(token: string, body: CreateLeadInput, branchId?: string) {
  return request<SalesLead>(`/sales/leads${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

export function createBooking(token: string, body: { bookingNo?: string; bookingDate: string; status?: 'RESERVED' | 'CONFIRMED' | 'INVOICED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'; customerId?: string; vehicleId?: string; leadId?: string; totalAmount?: number; discountAmount?: number; notes?: string }) {
  return request<unknown>('/sales/bookings', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
}

export interface LeadActivity { id: string; leadId: string; type: 'FOLLOW_UP' | 'NOTE' | 'CALL' | 'EMAIL' | 'SMS' | 'MEETING'; status: 'OPEN' | 'COMPLETED' | 'CANCELLED'; subject?: string; notes: string; dueAt?: string; completedAt?: string; createdAt: string }
export interface SalesBookingDetail { id: string; bookingNo: string; status: string; approvalStatus: string; allocationStatus: string; totalAmount: number | string; discountAmount: number | string; customer?: unknown; vehicle?: unknown; statusHistory?: unknown[]; documents?: unknown[]; paymentSchedules?: unknown[]; invoices?: unknown[]; payments?: unknown[]; deliveries?: unknown[]; requests?: unknown[] }
export interface SalesReport { leads: number; wonLeads: number; conversionRate: number; bookings: number; cancellations: number; deliveries: number; invoices: number; invoicedAmount: number; receivedAmount: number; bySalesperson: unknown[] }
export const getLeadActivities = (token: string, leadId: string) => request<LeadActivity[]>(`/sales/leads/${encodeURIComponent(leadId)}/activities`, { headers: { Authorization: `Bearer ${token}` } })
export const createLeadActivity = (token: string, leadId: string, body: { type: LeadActivity['type']; subject?: string; notes: string; dueAt?: string }) => request<LeadActivity>(`/sales/leads/${encodeURIComponent(leadId)}/activities`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
export const completeLeadActivity = (token: string, id: string) => request<LeadActivity>(`/sales/lead-activities/${encodeURIComponent(id)}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
export const getSalesBooking = (token: string, id: string) => request<SalesBookingDetail>(`/sales/bookings/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } })
export const updateSalesBookingStatus = (token: string, id: string, body: { status: string; notes?: string }) => request<SalesBookingDetail>(`/sales/bookings/${encodeURIComponent(id)}/status`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
export const getPaymentSchedules = (token: string, bookingId: string) => request<unknown[]>(`/sales/bookings/${encodeURIComponent(bookingId)}/payment-schedule`, { headers: { Authorization: `Bearer ${token}` } })
export const createPaymentSchedule = (token: string, bookingId: string, lines: Array<{ installmentNo: number; dueDate: string; amount: number; notes?: string }>) => request<unknown[]>(`/sales/bookings/${encodeURIComponent(bookingId)}/payment-schedule`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ lines }) })
export const getBookingRequests = (token: string, bookingId: string) => request<unknown[]>(`/sales/bookings/${encodeURIComponent(bookingId)}/requests`, { headers: { Authorization: `Bearer ${token}` } })
export const createBookingRequest = (token: string, bookingId: string, body: { type: string; reason: string; amount?: number; vehicleId?: string }) => request<unknown>(`/sales/bookings/${encodeURIComponent(bookingId)}/requests`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
export const decideBookingRequest = (token: string, id: string, decision: 'APPROVED' | 'REJECTED', notes?: string) => request<unknown>(`/sales/booking-requests/${encodeURIComponent(id)}/decision`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ decision, notes }) })
export const createSalesInvoice = (token: string, bookingId: string, tax = 0) => request<unknown>(`/sales/bookings/${encodeURIComponent(bookingId)}/invoice`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ tax }) })
export const postSalesInvoice = (token: string, invoiceId: string) => request<unknown>(`/sales/invoices/${encodeURIComponent(invoiceId)}/post`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
export const createSalesPayment = (token: string, bookingId: string, body: { amount: number; scheduleId?: string; paymentMethod?: string; reference?: string; type?: 'RECEIPT' | 'REFUND' }) => request<unknown>(`/sales/bookings/${encodeURIComponent(bookingId)}/payments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
export const deliverSalesBooking = (token: string, bookingId: string, body: { deliveredAt?: string; deliveredTo?: string; notes?: string } = {}) => request<unknown>(`/sales/bookings/${encodeURIComponent(bookingId)}/delivery`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
export const getSalesReports = (token: string, query?: { from?: string; to?: string; ownerId?: string }) => { const params = new URLSearchParams(); Object.entries(query || {}).forEach(([key, value]) => value && params.set(key, value)); return request<SalesReport>(`/sales/reports${params.toString() ? `?${params}` : ''}`, { headers: { Authorization: `Bearer ${token}` } }) }

export interface Part { id: string; code: string; name: string; description?: string; unit: string; reorderLevel: number; isActive?: boolean }
export interface Supplier { id: string; code: string; name: string; phone?: string; email?: string; address?: string; isActive?: boolean }
export interface StockBalance { id: string; locationId: string; itemCode: string; quantity: number; averageCost?: number | string; inventoryValue?: number | string; updatedAt?: string; part?: Pick<Part, 'code' | 'name' | 'unit' | 'reorderLevel'> | null }
export interface StockCommand { locationId: string; itemCode: string; quantity: number; unitCost?: number; jobCardId?: string; requestId?: string; reference?: string }
export interface PartCategory { id: string; code: string; name: string; isActive?: boolean }
export interface PurchaseOrderLine { id?: string; partId?: string; partCode?: string; quantity: number | string; receivedQuantity?: number | string; unitCost: number | string }
export interface PurchaseOrder { id: string; orderNo: string; supplierId: string; status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'; orderedAt: string; notes?: string; supplier?: Supplier; lines: PurchaseOrderLine[]; receipts?: Array<{ id: string; receiptNo: string; receivedAt: string }> }

function partsRequest<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(`/parts${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
}

export interface CreatePartInput {
  code: string;
  name: string;
  description?: string;
  unit?: string;
  reorderLevel?: number;
  maxStockLevel?: number;
  categoryCode?: string;
}

export function getParts(token: string) { return partsRequest<Part[]>(token, '') }
export function getPartCategories(token: string) { return partsRequest<PartCategory[]>(token, '/categories') }
export function createPartCategory(token: string, body: { code: string; name: string }) { return partsRequest<PartCategory>(token, '/categories', { method: 'POST', body: JSON.stringify(body) }) }
export function createPart(token: string, body: CreatePartInput) { return partsRequest<Part>(token, '', { method: 'POST', body: JSON.stringify(body) }) }
export function createPartsBatch(token: string, body: CreatePartInput[]) { return partsRequest<Part[]>(token, '/batch', { method: 'POST', body: JSON.stringify(body) }) }
export function getSuppliers(token: string) { return partsRequest<Supplier[]>(token, '/suppliers') }
export function getStock(token: string, locationId?: string) { return partsRequest<StockBalance[]>(token, `/stock${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`) }
export function receiveStock(token: string, command: StockCommand) { return partsRequest<StockBalance>(token, '/receive', { method: 'POST', body: JSON.stringify(command) }) }
export function issueStock(token: string, command: StockCommand) { return partsRequest<StockBalance>(token, '/issue', { method: 'POST', body: JSON.stringify(command) }) }
export function returnStock(token: string, command: StockCommand) { return partsRequest<StockBalance>(token, '/return', { method: 'POST', body: JSON.stringify(command) }) }

export interface StockMovementRecord {
  id: string
  itemCode: string
  type: 'RECEIPT' | 'ISSUE' | 'RETURN' | 'TRANSFER' | 'ADJUSTMENT'
  quantity: number | string
  reference?: string
  createdAt: string
  location?: { id: string; code: string; name: string }
  part?: { code: string; name: string; unit: string } | null
}

export function getMovements(token: string, locationId?: string) {
  return partsRequest<StockMovementRecord[]>(token, `/movements${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`)
}
export function getLowStockAlerts(token: string, locationId?: string) { return partsRequest<StockBalance[]>(token, `/stock/low-stock${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ''}`) }
export function getPurchaseOrders(token: string) { return partsRequest<PurchaseOrder[]>(token, '/purchase-orders') }
export function createPurchaseOrder(token: string, body: { supplierId: string; notes?: string; lines: Array<{ partCode: string; quantity: number; unitCost: number }> }) { return partsRequest<PurchaseOrder>(token, '/purchase-orders', { method: 'POST', body: JSON.stringify(body) }) }
export function receivePurchaseOrder(token: string, id: string, locationId: string) { return partsRequest<unknown>(token, `/purchase-orders/${encodeURIComponent(id)}/receive`, { method: 'POST', body: JSON.stringify({ locationId }) }) }
export function transferStock(token: string, body: { fromLocationId: string; toLocationId: string; itemCode: string; quantity: number; reference?: string }) { return partsRequest<unknown>(token, '/transfer', { method: 'POST', body: JSON.stringify(body) }) }
export function adjustStock(token: string, body: { locationId: string; itemCode: string; newQuantity: number; reason?: string }) { return partsRequest<unknown>(token, '/adjust', { method: 'POST', body: JSON.stringify(body) }) }

export type ServiceStatus = 'OPEN' | 'ESTIMATED' | 'APPROVED' | 'IN_PROGRESS' | 'WAITING_PARTS' | 'QUALITY_CHECK' | 'READY_FOR_INVOICE' | 'INVOICED' | 'CLOSED' | 'CANCELLED'
export interface ServiceJobCard { id: string; jobNo: string; branchId?: string; complaint?: string; odometer?: number; status: ServiceStatus; openedAt?: string; isWarranty?: boolean; warrantyRef?: string; package?: ServicePackage | null; customer?: { id: string; name: string; phone?: string }; vehicle?: { id: string; make?: string; model?: string; modelYear?: number; registrationNo?: string; vin?: string }; assignments?: Array<{ technician?: { id: string; username: string } }>; }
export interface ServicePackage { id: string; code: string; name: string; description?: string; price: number | string; status?: string }
export interface ServiceReport { byStatus: Array<{ status: ServiceStatus; _count: { _all: number } }>; revenue: number; invoiceCount: number; laborHours: number; pendingWork: number; technicianLoad: unknown[] }
export interface ServiceEstimateLine { description: string; quantity: number; unitPrice: number; lineType: 'LABOR' | 'PART' | 'OTHER'; partId?: string }
export interface ServiceEstimate { lines: ServiceEstimateLine[]; notes?: string }
export interface TechnicianAssignment { technicianId: string }
export interface PartsRequest { locationId: string; lines: Array<{ partId: string; quantity: number }> }
export interface LaborEntry { description: string; hours: number; rate: number; technicianId?: string }
export interface InspectionEntry { checklist: Record<string, unknown>; passed: boolean; notes?: string }
export interface InvoiceReadySummary { jobCardId: string; customer: unknown; vehicle: unknown; subtotal: number | string; tax: number | string; total: number | string; traceablePartsRequests: unknown[] }

function serviceRequest<T>(token: string, path: string, options: RequestInit = {}) {
  return request<T>(`/service${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
}
export function getJobCards(token: string, branchId?: string) { return serviceRequest<ServiceJobCard[]>(token, `/job-cards${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`) }
export function createJobCard(token: string, body: { branchId: string; customerId: string; vehicleId: string; complaint?: string; odometer?: number; packageId?: string; isWarranty?: boolean; warrantyRef?: string }) { return serviceRequest<ServiceJobCard>(token, '/job-cards', { method: 'POST', body: JSON.stringify(body) }) }
export function getServicePackages(token: string) { return serviceRequest<ServicePackage[]>(token, '/packages') }
export function createServicePackage(token: string, body: { code: string; name: string; price: number; description?: string }) { return serviceRequest<ServicePackage>(token, '/packages', { method: 'POST', body: JSON.stringify(body) }) }
export function createEstimate(token: string, jobCardId: string, body: ServiceEstimate) { return serviceRequest<ServiceEstimate>(token, `/job-cards/${jobCardId}/estimates`, { method: 'POST', body: JSON.stringify(body) }) }
export function requestJobParts(token: string, jobCardId: string, body: PartsRequest) { return requestParts(token, jobCardId, body) }
export function approveEstimate(token: string, estimateId: string) { return serviceRequest<ServiceEstimate>(token, `/estimates/${estimateId}/approve`, { method: 'POST' }) }
export function assignTechnician(token: string, jobCardId: string, body: TechnicianAssignment) { return serviceRequest<unknown>(token, `/job-cards/${jobCardId}/technician`, { method: 'POST', body: JSON.stringify(body) }) }
export function requestParts(token: string, jobCardId: string, body: PartsRequest) { return serviceRequest<unknown>(token, `/job-cards/${jobCardId}/parts`, { method: 'POST', body: JSON.stringify(body) }) }
export function recordLabor(token: string, jobCardId: string, body: LaborEntry) { return serviceRequest<unknown>(token, `/job-cards/${jobCardId}/labor`, { method: 'POST', body: JSON.stringify(body) }) }
export function updateJobCardStatus(token: string, jobCardId: string, status: ServiceStatus) { return serviceRequest<ServiceJobCard>(token, `/job-cards/${jobCardId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }) }
export function recordInspection(token: string, jobCardId: string, body: InspectionEntry) { return serviceRequest<unknown>(token, `/job-cards/${jobCardId}/inspection`, { method: 'POST', body: JSON.stringify(body) }) }
export function getServiceCheckEvents(token: string, jobCardId: string) { return serviceRequest<unknown[]>(token, `/job-cards/${jobCardId}/check-events`) }
export function recordServiceCheckEvent(token: string, jobCardId: string, body: { type: 'CHECK_IN' | 'CHECK_OUT'; odometer?: number; fuelLevel?: string; checklist?: Record<string, unknown>; notes?: string }) { return serviceRequest<unknown>(token, `/job-cards/${jobCardId}/check-events`, { method: 'POST', body: JSON.stringify(body) }) }
export function getInvoiceReadySummary(token: string, jobCardId: string) { return serviceRequest<InvoiceReadySummary>(token, `/job-cards/${jobCardId}/invoice-ready`) }
export function getJobCard(token: string, jobCardId: string) { return serviceRequest<ServiceJobCard>(token, `/job-cards/${jobCardId}`) }
export function getVehicleServiceHistory(token: string, vehicleId: string) { return serviceRequest<unknown>(token, `/history/vehicle/${vehicleId}`) }
export function getCustomerServiceHistory(token: string, customerId: string) { return serviceRequest<unknown>(token, `/history/customer/${customerId}`) }
export function getServiceInvoices(token: string, branchId?: string) { return serviceRequest<unknown[]>(token, `/invoices${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`) }
export function postServiceInvoice(token: string, invoiceId: string) { return serviceRequest<unknown>(token, `/invoices/${invoiceId}/post`, { method: 'POST' }) }
export function getServiceWorkloadReport(token: string, query?: { branchId?: string; from?: string; to?: string }) { const q = new URLSearchParams(); Object.entries(query || {}).forEach(([k, v]) => v && q.set(k, v)); return serviceRequest<ServiceReport>(token, `/reports/workload${q.toString() ? `?${q}` : ''}`) }
export function getServicePerformanceReport(token: string, query?: { branchId?: string; from?: string; to?: string }) { const q = new URLSearchParams(); Object.entries(query || {}).forEach(([k, v]) => v && q.set(k, v)); return serviceRequest<ServiceReport>(token, `/reports/performance${q.toString() ? `?${q}` : ''}`) }


// Body & Paint workspace contracts. These are intentionally separate from mechanical
// service contracts so the repair workflow can evolve without weakening existing types.
export type BodyPaintStatus = 'OPEN' | 'INTAKE' | 'ASSESSMENT' | 'PENDING_APPROVAL' | 'AWAITING_APPROVAL' | 'APPROVED' | 'IN_PROGRESS' | 'IN_REPAIR' | 'PAINT' | 'QUALITY_CHECK' | 'READY_FOR_INVOICE' | 'READY_FOR_COLLECTION' | 'INVOICED' | 'CLOSED' | 'CANCELLED'
export type ApprovalParty = 'CUSTOMER' | 'INSURER'
export interface RepairOrder { id: string; orderNo: string; status: BodyPaintStatus; openedAt?: string; dueDate?: string; customer: { id: string; name: string; phone?: string }; vehicle: { id: string; make: string; model: string; modelYear?: number; registrationNo?: string; vin?: string; colour?: string }; insuranceCases?: Array<{ insurerName: string; policyNo?: string; claimNo?: string; status: string; approvedAmount?: number | string; deductible?: number | string }>; insurance?: { provider: string; claimNo?: string; excess?: number }; estimatedTotal?: number; approvedTotal?: number }
export interface InsuranceCase { id: string; repairOrderId: string; insurerName: string; provider?: string; policyNo?: string; claimNo?: string; assessor?: string; status: 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SETTLED' | 'CLOSED'; approvedAmount?: number | string; deductible?: number | string; coverage?: number; excess?: number }
export interface DamageAssessment { id: string; repairOrderId: string; area: string; severity: 'MINOR' | 'MODERATE' | 'MAJOR'; description: string; estimatedCost?: number; photoCount?: number; status?: string }
export interface RepairApproval { id: string; repairOrderId: string; party: ApprovalParty; status: 'PENDING' | 'APPROVED' | 'DECLINED'; amount?: number; approvedBy?: string; updatedAt?: string; notes?: string }
export interface BodyPaintOperation { id: string; repairOrderId: string; operation: string; category: 'PANEL' | 'PAINT' | 'DETAIL' | 'OTHER'; status: 'QUEUED' | 'IN_PROGRESS' | 'DONE'; technician?: string; hours?: number }
export interface VehicleMovement { id: string; repairOrderId: string; from: string; to: string; movedAt: string; movedBy?: string; note?: string }
export interface MaterialConsumption { id: string; repairOrderId: string; item: string; quantity: number; unit: string; cost?: number; consumedAt?: string }
export interface InvoiceReadyRepairSummary { repairOrderId: string; customer: unknown; vehicle: unknown; subtotal: number | string; tax: number | string; total: number | string; laborTotal?: number | string; materialsTotal?: number | string; insurerPayable?: number | string; customerPayable?: number | string; approvals: RepairApproval[]; operations: BodyPaintOperation[]; materials: MaterialConsumption[] }
export interface BodyPaintInvoice { id: string; repairOrderId: string; invoiceNo: string; status: 'READY' | 'POSTED' | 'PAID'; laborTotal: number | string; materialsTotal: number | string; subtotal: number | string; tax: number | string; total: number | string; insurerPayable: number | string; customerPayable: number | string; repairOrder?: RepairOrder }
export interface BodyPaintFinalInspection { id: string; repairOrderId: string; passed: boolean; checklist: Record<string, unknown>; notes?: string; inspectedAt: string; inspector?: { id: string; username: string } }
export interface BodyPaintReport { filter?: unknown; byStatus: Array<{ status: string; _count: { _all: number } }>; revenue: number; invoiceCount: number; laborHours: number; materialQuantity: number; pendingWork: number; technicianLoad: unknown[] }
export interface RepairOrderStatusUpdate { status: BodyPaintStatus; note?: string }
export interface BodyPaintOperationInput { type: 'BODY' | 'PAINT'; description: string; status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'; hours?: number; rate?: number; technicianId?: string }
export interface VehicleMovementInput { fromLocationId?: string; toLocationId?: string; notes?: string }
export interface MaterialConsumptionInput { partId: string; operationId?: string; quantity: number; unitCost?: number }

function bodyPaintRequest<T>(token: string, path: string, options: RequestInit = {}) {
  return request<T>(`/body-paint${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
}
export function getRepairOrders(token: string, filters?: { status?: BodyPaintStatus; insurance?: string }) { const query = new URLSearchParams(); if (filters?.status) query.set('status', filters.status); if (filters?.insurance) query.set('insurance', filters.insurance); return bodyPaintRequest<RepairOrder[]>(token, `/repair-orders${query.toString() ? `?${query}` : ''}`) }
export function createRepairOrder(token: string, body: { branchId: string; customerId: string; vehicleId: string; complaint?: string }) { return bodyPaintRequest<RepairOrder>(token, '/repair-orders', { method: 'POST', body: JSON.stringify(body) }) }
export function getInsuranceCases(token: string, repairOrderId: string) { return bodyPaintRequest<InsuranceCase[]>(token, `/repair-orders/${repairOrderId}/insurance`) }
export function createInsuranceCase(token: string, repairOrderId: string, body: Omit<InsuranceCase, 'id' | 'repairOrderId'>) { return bodyPaintRequest<InsuranceCase>(token, `/repair-orders/${repairOrderId}/insurance`, { method: 'POST', body: JSON.stringify(body) }) }
export function getDamageAssessments(token: string, repairOrderId: string) { return bodyPaintRequest<DamageAssessment[]>(token, `/repair-orders/${repairOrderId}/damage-assessments`) }
export function createDamageAssessment(token: string, repairOrderId: string, body: { damageAreas?: Record<string, unknown>; estimatedLabor?: number; estimatedMaterials?: number; notes?: string; area?: string; description?: string; severity?: string; photoCount?: number }) { const payload = body.damageAreas ? body : { damageAreas: { [body.area ?? 'General']: body.description ?? '' }, notes: body.description }; return bodyPaintRequest<DamageAssessment>(token, `/repair-orders/${repairOrderId}/damage-assessments`, { method: 'POST', body: JSON.stringify(payload) }) }
export function getRepairApprovals(token: string, repairOrderId: string) { return bodyPaintRequest<RepairApproval[]>(token, `/repair-orders/${repairOrderId}/approvals`) }
export function requestRepairApproval(token: string, repairOrderId: string, body: { type?: ApprovalParty; status?: 'PENDING'; approvedAmount?: number; notes?: string; party?: ApprovalParty; amount?: number }) { const payload = { type: body.type ?? body.party ?? 'CUSTOMER', status: body.status ?? 'PENDING', approvedAmount: body.approvedAmount ?? body.amount, notes: body.notes }; return bodyPaintRequest<RepairApproval>(token, `/repair-orders/${repairOrderId}/approvals`, { method: 'POST', body: JSON.stringify(payload) }) }
export function decideRepairApproval(token: string, approvalId: string, body: { status: 'APPROVED' | 'REJECTED'; notes?: string }) { return bodyPaintRequest<RepairApproval>(token, `/approvals/${approvalId}/decision`, { method: 'POST', body: JSON.stringify(body) }) }
export function getBodyPaintOperations(token: string, repairOrderId: string) { return bodyPaintRequest<BodyPaintOperation[]>(token, `/repair-orders/${repairOrderId}/operations`) }
export function createBodyPaintOperation(token: string, repairOrderId: string, body: BodyPaintOperationInput | { operation: string; category: 'PANEL' | 'PAINT' | 'DETAIL' | 'OTHER' }) { const payload = 'description' in body ? body : { type: body.category === 'PAINT' ? 'PAINT' : 'BODY', description: body.operation }; return bodyPaintRequest<BodyPaintOperation>(token, `/repair-orders/${repairOrderId}/operations`, { method: 'POST', body: JSON.stringify(payload) }) }
export function getVehicleMovements(token: string, repairOrderId: string) { return bodyPaintRequest<VehicleMovement[]>(token, `/repair-orders/${repairOrderId}/movements`) }
export function recordVehicleMovement(token: string, repairOrderId: string, body: VehicleMovementInput | { from: string; to: string; note?: string }) { const payload = 'from' in body ? { fromLocationId: body.from, toLocationId: body.to, notes: body.note } : body; return bodyPaintRequest<VehicleMovement>(token, `/repair-orders/${repairOrderId}/movements`, { method: 'POST', body: JSON.stringify(payload) }) }
export function getMaterialConsumptions(token: string, repairOrderId: string) { return bodyPaintRequest<MaterialConsumption[]>(token, `/repair-orders/${repairOrderId}/materials`) }
export function recordMaterialConsumption(token: string, repairOrderId: string, body: MaterialConsumptionInput | { item: string; quantity: number; unit: string; cost?: number }) { const payload = 'partId' in body ? body : { partId: body.item, quantity: body.quantity, unitCost: body.cost }; return bodyPaintRequest<MaterialConsumption>(token, `/repair-orders/${repairOrderId}/materials`, { method: 'POST', body: JSON.stringify(payload) }) }
export function updateRepairOrderStatus(token: string, repairOrderId: string, body: RepairOrderStatusUpdate) { return bodyPaintRequest<RepairOrder>(token, `/repair-orders/${repairOrderId}/status`, { method: 'PUT', body: JSON.stringify({ ...body, status: body.status === 'AWAITING_APPROVAL' ? 'PENDING_APPROVAL' : body.status }) }) }
export function getBodyPaintInvoiceReadySummary(token: string, repairOrderId: string) { return bodyPaintRequest<InvoiceReadyRepairSummary>(token, `/repair-orders/${repairOrderId}/invoice-ready`) }
export function createBodyPaintInvoice(token: string, repairOrderId: string) { return bodyPaintRequest<BodyPaintInvoice>(token, `/repair-orders/${repairOrderId}/invoice`, { method: 'POST' }) }
export function getBodyPaintInvoices(token: string, query?: { branchId?: string; repairOrderId?: string; status?: string }) { const q = new URLSearchParams(); Object.entries(query || {}).forEach(([k, v]) => v && q.set(k, v)); return bodyPaintRequest<BodyPaintInvoice[]>(token, `/invoices${q.toString() ? `?${q}` : ''}`) }
export function postBodyPaintInvoice(token: string, invoiceId: string) { return bodyPaintRequest<BodyPaintInvoice>(token, `/invoices/${invoiceId}/post`, { method: 'POST' }) }
export function createBodyPaintFinalInspection(token: string, repairOrderId: string, body: { checklist: Record<string, unknown>; passed: boolean; notes?: string }) { return bodyPaintRequest<BodyPaintFinalInspection>(token, `/repair-orders/${repairOrderId}/final-inspection`, { method: 'POST', body: JSON.stringify(body) }) }
export function getBodyPaintFinalInspections(token: string, repairOrderId: string) { return bodyPaintRequest<BodyPaintFinalInspection[]>(token, `/repair-orders/${repairOrderId}/final-inspections`) }
export function deliverBodyPaintOrder(token: string, repairOrderId: string) { return bodyPaintRequest<RepairOrder>(token, `/repair-orders/${repairOrderId}/deliver`, { method: 'POST' }) }
export function getBodyPaintWorkloadReport(token: string, query?: { branchId?: string; from?: string; to?: string }) { const q = new URLSearchParams(); Object.entries(query || {}).forEach(([k, v]) => v && q.set(k, v)); return bodyPaintRequest<BodyPaintReport>(token, `/reports/workload${q.toString() ? `?${q}` : ''}`) }
export function getBodyPaintPerformanceReport(token: string, query?: { branchId?: string; from?: string; to?: string }) { const q = new URLSearchParams(); Object.entries(query || {}).forEach(([k, v]) => v && q.set(k, v)); return bodyPaintRequest<BodyPaintReport>(token, `/reports/performance${q.toString() ? `?${q}` : ''}`) }
export function getRepairOrder(token: string, repairOrderId: string) { return bodyPaintRequest<RepairOrder>(token, `/repair-orders/${repairOrderId}`) }
export function getVehicleRepairHistory(token: string, vehicleId: string) { return bodyPaintRequest<unknown>(token, `/history/vehicle/${vehicleId}`) }
export function getCustomerRepairHistory(token: string, customerId: string) { return bodyPaintRequest<unknown>(token, `/history/customer/${customerId}`) }

// Accounts & Finance workspace contracts.
export type FinanceRecordStatus = 'DRAFT' | 'POSTED' | 'REVERSED' | 'PENDING' | 'APPROVED' | 'MATCHED' | 'UNMATCHED'
export interface FinanceAccount { id: string; code: string; name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; balance: number; isActive?: boolean }
export interface FiscalPeriod { id: string; name: string; startsOn: string; endsOn: string; status: 'OPEN' | 'CLOSED' | 'LOCKED' }
export interface Receivable { id: string; reference?: string; customer?: string | { id: string; name: string }; dueDate: string; amount: number; outstanding: number; status: FinanceRecordStatus; document?: { documentNo: string } }
export interface Payable { id: string; reference?: string; supplier?: string | { id: string; name: string }; dueDate: string; amount: number; outstanding: number; status: FinanceRecordStatus; document?: { documentNo: string } }
export interface TrialBalanceRow { accountId: string; code: string; account: string; debit: number; credit: number; balance: number }
export interface LedgerEntry { id: string; date: string; reference: string; description: string; debit: number; credit: number; runningBalance: number; status: FinanceRecordStatus }
export interface JournalLine { accountId: string; description?: string; debit: number; credit: number }
export interface JournalDraft { id: string; number: string; date: string; description: string; lines: JournalLine[]; total: number; status: 'DRAFT' | 'POSTED' | 'REVERSED' }
export interface Expense { id: string; reference: string; submittedBy: string; category: string; date: string; amount: number; status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'POSTED' | 'REJECTED' }
export interface BankTransaction { id: string; date: string; description: string; reference?: string; amount: number; type: 'DEBIT' | 'CREDIT'; status: 'MATCHED' | 'UNMATCHED' }
export interface Reconciliation { id: string; accountId: string; statementDate: string; statementBalance: number; bookBalance: number; difference: number; status: 'OPEN' | 'COMPLETED' }

function financeRequest<T>(token: string, path: string, options: RequestInit = {}) {
  return request<T>(`/finance${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
}
const financeGet = <T>(token: string, path: string) => financeRequest<T>(token, path)
const financePost = <T>(token: string, path: string, body?: unknown) => financeRequest<T>(token, path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
export const getFinanceAccounts = (token: string) => financeGet<FinanceAccount[]>(token, '/accounts')
export const createFinanceAccount = (token: string, body: { code: string; name: string; type: string; parentId?: string }) => financePost<FinanceAccount>(token, '/accounts', body)
export const getFiscalPeriods = (token: string) => financeGet<FiscalPeriod[]>(token, '/fiscal-periods')
export const createFiscalPeriod = (token: string, body: { name: string; startsOn: string; endsOn: string }) => financePost<FiscalPeriod>(token, '/fiscal-periods', body)
export const closeFiscalPeriod = (token: string, periodId: string, checklist?: string[]) => financePost<FiscalPeriod>(token, `/fiscal-periods/${encodeURIComponent(periodId)}/close`, { checklist })
export const reopenFiscalPeriod = (token: string, periodId: string, reason?: string) => financePost<FiscalPeriod>(token, `/fiscal-periods/${encodeURIComponent(periodId)}/reopen`, { reason })
export const getReceivables = (token: string, query?: { customerId?: string; status?: string }) => {
  const params = new URLSearchParams()
  if (query?.customerId) params.set('customerId', query.customerId)
  if (query?.status) params.set('status', query.status)
  const qs = params.toString()
  return financeGet<Receivable[]>(token, `/receivables${qs ? `?${qs}` : ''}`)
}
export const settleReceivable = (token: string, receivableId: string, body: { amount: number; paymentMethod?: string; reference?: string; bankAccountId?: string }) => financePost<unknown>(token, `/receivables/${encodeURIComponent(receivableId)}/settle`, body)
export const getCustomerLedger = (token: string, customerId: string) => financeGet<unknown>(token, `/customers/${encodeURIComponent(customerId)}/ledger`)
export const getPayables = (token: string, query?: { supplierId?: string; status?: string }) => {
  const params = new URLSearchParams()
  if (query?.supplierId) params.set('supplierId', query.supplierId)
  if (query?.status) params.set('status', query.status)
  const qs = params.toString()
  return financeGet<Payable[]>(token, `/payables${qs ? `?${qs}` : ''}`)
}
export const settlePayable = (token: string, payableId: string, body: { amount: number; paymentMethod?: string; reference?: string; bankAccountId?: string }) => financePost<unknown>(token, `/payables/${encodeURIComponent(payableId)}/settle`, body)
export const getSupplierLedger = (token: string, supplierId: string) => financeGet<unknown>(token, `/suppliers/${encodeURIComponent(supplierId)}/ledger`)
export const getTrialBalance = (token: string, periodId?: string) => financeGet<TrialBalanceRow[]>(token, `/trial-balance${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ''}`)
export const getIncomeStatement = (token: string, periodId?: string) => financeGet<unknown>(token, `/financial-statements/income-statement${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ''}`)
export const getBalanceSheet = (token: string, asOfDate?: string) => financeGet<unknown>(token, `/financial-statements/balance-sheet${asOfDate ? `?asOfDate=${encodeURIComponent(asOfDate)}` : ''}`)
export const getAccountLedger = (token: string, accountId: string) => financeGet<LedgerEntry[]>(token, `/accounts/${encodeURIComponent(accountId)}/ledger`)
export const getJournalDrafts = (token: string) => financeGet<JournalDraft[]>(token, '/journals')
export const createJournalDraft = (token: string, body: Omit<JournalDraft, 'id' | 'number' | 'status'>) => financePost<JournalDraft>(token, '/journals', body)
export const postJournal = (token: string, journalId: string) => financePost<JournalDraft>(token, `/journals/${encodeURIComponent(journalId)}/post`)
export const reverseJournal = (token: string, journalId: string, reason?: string) => financePost<JournalDraft>(token, `/journals/${encodeURIComponent(journalId)}/reverse`, reason ? { reason } : undefined)
export const getExpenses = (token: string) => financeGet<Expense[]>(token, '/expenses')
export const createExpense = (token: string, body: { expenseDate?: string; description?: string; amount: number; expenseAccountId?: string; submittedBy?: string; category?: string; date?: string }) => financePost<Expense>(token, '/expenses', { expenseDate: body.expenseDate ?? new Date(`${body.date ?? new Date().toISOString().slice(0, 10)}T00:00:00.000Z`).toISOString(), description: body.description ?? body.category ?? 'General expense', amount: body.amount, expenseAccountId: body.expenseAccountId ?? 'a-5000' })
export const approveExpense = (token: string, expenseId: string) => financePost<Expense>(token, `/expenses/${encodeURIComponent(expenseId)}/approve`)
export const postExpense = (token: string, expenseId: string) => financePost<Expense>(token, `/expenses/${encodeURIComponent(expenseId)}/post`)
export const getBankTransactions = (token: string, accountId?: string) => financeGet<BankTransaction[]>(token, `/bank-transactions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ''}`)
export const getReconciliations = (token: string) => financeGet<Reconciliation[]>(token, '/reconciliations')
export const reconcileTransaction = (token: string, transactionId: string, body: { accountId: string; journalId?: string }) => financePost<BankTransaction>(token, `/bank-transactions/${encodeURIComponent(transactionId)}/reconcile`, body)

export interface FinancialNotification {
  id: string
  sourceType: string
  sourceId: string
  department?: 'BODY_PAINT' | 'SERVICE' | 'SALES'
  departmentLabel?: string
  category: 'PAINT_COMPLETED' | 'BODY_REPAIR_COMPLETED' | 'SERVICE_COMPLETED' | 'VEHICLE_SALE_CONFIRMED'
  title: string
  message: string
  referenceNo: string
  customerName: string
  customerId?: string
  vehicleName: string
  amount: number
  date: string
  status: string
  isRecorded: boolean
  documentNo?: string
}

export interface FeedNotificationItem {
  id: string
  department: 'SALES' | 'SERVICE' | 'BODY_PAINT' | 'PARTS' | 'CASHIER' | 'FINANCE' | 'GENERAL'
  departmentLabel: string
  category: string
  title: string
  message: string
  referenceNo?: string
  amount?: number
  date: string
  status?: string
  priority?: 'HIGH' | 'NORMAL' | 'LOW'
  actionWorkspace?: string
  isRead?: boolean
  sourceType?: string
  sourceId?: string
  customerId?: string
  isRecorded?: boolean
  documentNo?: string
}

export interface RecordNotificationBody {
  sourceType: string
  sourceId: string
  amount: number
  customerId?: string
  referenceNo: string
  description?: string
}

// Generic authenticated GET/POST helpers used by the notification endpoints below.
const apiGet = <T>(token: string, path: string) =>
  request<T>(path, { headers: { Authorization: `Bearer ${token}` } })

const apiPost = <T>(token: string, path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

export const getNotificationFeed = (token: string, department?: string) =>
  apiGet<FeedNotificationItem[]>(token, `/foundation/feed${department ? `?department=${encodeURIComponent(department)}` : ''}`)

export const getUserNotifications = (token: string) =>
  apiGet<Array<{ id: string; type: string; title: string; message: string; readAt?: string; createdAt: string }>>(token, '/foundation/notifications')

export const markNotificationRead = (token: string, id: string) =>
  apiPost<{ id: string; readAt: string }>(token, `/foundation/notifications/${id}/read`, {})

export const getFinancialNotifications = (token: string, department?: string, category?: string) => {
  const params = new URLSearchParams()
  if (department) params.set('department', department)
  if (category) params.set('category', category)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return financeGet<FinancialNotification[]>(token, `/notifications${qs}`)
}
export const recordNotificationAsReceivable = (token: string, body: RecordNotificationBody) => financePost<{ success: boolean; documentNo: string; receivableId?: string }>(token, '/notifications/record', body)

// Cashier workspace contracts. Amounts may arrive as strings from Prisma Decimal serialization.
export type CashierPaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
export type CashierSessionStatus = 'OPEN' | 'CLOSED'
export type CashierTransactionType = 'CASH_IN' | 'CASH_OUT' | 'RECEIPT' | 'PAYMENT_VOUCHER' | 'REVERSAL'
export type CashierTransactionStatus = 'POSTED' | 'REVERSED'
export interface CashierTransaction { id: string; sessionId: string; type: CashierTransactionType; amount: number | string; paymentMethod: CashierPaymentMethod; reason?: string; sourceType?: string; sourceId?: string; status: CashierTransactionStatus; createdAt?: string; originalTransactionId?: string | null }
export interface CashierReceipt { id: string; receiptNo: string; transactionId: string; amount: number | string; paymentMethod: CashierPaymentMethod; customerId?: string; status?: string; createdAt?: string }
export interface PaymentVoucher { id: string; voucherNo: string; transactionId: string; payee: string; amount: number | string; paymentMethod: CashierPaymentMethod; reason: string; status?: string; createdAt?: string }
export interface DailyCashierClosing { id: string; sessionId: string; closingDate: string; expectedAmount: number | string; actualAmount: number | string; variance: number | string; notes?: string; status?: string }
export interface CashierSession { id: string; branchId: string; cashierId: string; status: CashierSessionStatus; openingBalance: number | string; expectedBalance?: number | string | null; closingBalance?: number | string | null; openedAt?: string; closedAt?: string | null; cashier?: { id: string; username: string }; closing?: DailyCashierClosing | null; transactions?: CashierTransaction[]; receipts?: CashierReceipt[]; vouchers?: PaymentVoucher[] }
export interface CashMovementInput { amount: number; paymentMethod: CashierPaymentMethod; reason?: string; sourceType?: string; sourceId?: string }
export interface OpenCashierSessionInput { openingBalance: number }
export interface CloseCashierSessionInput { actualBalance: number; notes?: string }
export interface ReceiptInput extends CashMovementInput { customerId?: string }
export interface PaymentVoucherInput extends CashMovementInput { payee: string; reason: string }
export interface ReconciliationInput { closingDate: string; actualAmount: number; notes?: string }

function cashierRequest<T>(token: string, path: string, options: RequestInit = {}) { return request<T>(`/cashier${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } }) }
export const getCashierSessions = (token: string, branchId?: string) => cashierRequest<CashierSession[]>(token, `/sessions${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ''}`)
export const getCashierSession = (token: string, sessionId: string) => cashierRequest<CashierSession>(token, `/sessions/${encodeURIComponent(sessionId)}`)
export const openCashierSession = (token: string, branchId: string, body: OpenCashierSessionInput) => cashierRequest<CashierSession>(token, `/sessions?branchId=${encodeURIComponent(branchId)}`, { method: 'POST', body: JSON.stringify(body) })
export const closeCashierSession = (token: string, sessionId: string, body: CloseCashierSessionInput) => cashierRequest<{ session: CashierSession; closing: DailyCashierClosing }>(token, `/sessions/${encodeURIComponent(sessionId)}/close`, { method: 'POST', body: JSON.stringify(body) })
export const cashIn = (token: string, sessionId: string, body: CashMovementInput) => cashierRequest<CashierTransaction>(token, `/sessions/${encodeURIComponent(sessionId)}/cash-in`, { method: 'POST', body: JSON.stringify(body) })
export const cashOut = (token: string, sessionId: string, body: CashMovementInput) => cashierRequest<CashierTransaction>(token, `/sessions/${encodeURIComponent(sessionId)}/cash-out`, { method: 'POST', body: JSON.stringify(body) })
export const createCashierReceipt = (token: string, sessionId: string, body: ReceiptInput) => cashierRequest<CashierReceipt>(token, `/sessions/${encodeURIComponent(sessionId)}/receipts`, { method: 'POST', body: JSON.stringify(body) })
export const createPaymentVoucher = (token: string, sessionId: string, body: PaymentVoucherInput) => cashierRequest<PaymentVoucher>(token, `/sessions/${encodeURIComponent(sessionId)}/payment-vouchers`, { method: 'POST', body: JSON.stringify(body) })
export const reverseCashierTransaction = (token: string, transactionId: string, body: { reason: string; approvedById?: string }) => cashierRequest<CashierTransaction>(token, `/transactions/${encodeURIComponent(transactionId)}/reversal`, { method: 'POST', body: JSON.stringify(body) })
export const reconcileCashierSession = (token: string, sessionId: string, body: ReconciliationInput) => cashierRequest<DailyCashierClosing>(token, `/sessions/${encodeURIComponent(sessionId)}/reconciliation`, { method: 'POST', body: JSON.stringify(body) })
export const getCashierReceipts = (token: string, query?: Record<string, string>) => { const q = new URLSearchParams(query).toString(); return cashierRequest<CashierReceipt[]>(token, `/receipts${q ? `?${q}` : ''}`) }
export const getCashierReceipt = (token: string, id: string) => cashierRequest<CashierReceipt>(token, `/receipts/${encodeURIComponent(id)}`)
export const getPrintableReceipt = (token: string, id: string) => cashierRequest<{ receiptNo: string; html: string; [key: string]: unknown }>(token, `/receipts/${encodeURIComponent(id)}/print`)
export const getPaymentVouchers = (token: string, query?: Record<string, string>) => { const q = new URLSearchParams(query).toString(); return cashierRequest<PaymentVoucher[]>(token, `/vouchers${q ? `?${q}` : ''}`) }
export const getPaymentVoucher = (token: string, id: string) => cashierRequest<PaymentVoucher>(token, `/vouchers/${encodeURIComponent(id)}`)
export const getPrintableVoucher = (token: string, id: string) => cashierRequest<{ voucherNo: string; html: string; [key: string]: unknown }>(token, `/vouchers/${encodeURIComponent(id)}/print`)
export const getCashierDiscrepancies = (token: string, query?: Record<string, string>) => { const q = new URLSearchParams(query).toString(); return cashierRequest<{ summary: Record<string, unknown>; records: unknown[] }>(token, `/reports/discrepancies${q ? `?${q}` : ''}`) }
export const getCashierSummary = (token: string, query?: Record<string, string>) => { const q = new URLSearchParams(query).toString(); return cashierRequest<{ dealershipTotals: Record<string, unknown>; byCashier: unknown[] }>(token, `/reports/summary${q ? `?${q}` : ''}`) }

// Phase 8 reporting and administration contracts.
export interface ReportFilter {
  branchId?: string
  from?: string
  to?: string
  period?: 'daily' | 'today' | 'monthly' | 'month' | 'annual' | 'year' | string
  page?: number
  pageSize?: number
  status?: string
  query?: string
  format?: 'json' | 'csv'
  basis?: 'accrual' | 'cash'
}
export interface ReportingKpis { filters: ReportFilter; sales: { customers: number; bookings: number }; service: { openJobs: number }; bodyPaint: { openOrders: number }; parts: { stockQuantity: number }; finance: { receivablesOutstanding: number; payablesOutstanding: number; expenses: number }; cashier: { postedAmount: number } }
export interface PaginatedResponse<T> { page: number; pageSize: number; total: number; data: T[] }
export interface ReportSummary { sales: Array<{ status: string; _count: { _all: number } }>; service: Array<{ status: string; _count: { _all: number } }>; bodyPaint: Array<{ status: string; _count: { _all: number } }>; parts: Array<{ itemCode: string; quantity: number; location?: { branchId: string; code: string } }>; finance: Array<{ status: string; amount: number }>; cashier: Array<{ status: string; _count: { _all: number } }> }
export interface ReportMetadata { generatedAt: string; filters: string[]; sources: string[]; periods: string[]; bases: string[]; formats: string[]; maxPageSize: number; format: string }
export interface DrilldownRow { id: string; [key: string]: unknown }
export interface AdminUser { id: string; username: string; email: string; isActive: boolean; createdAt: string; roles: Array<{ id: string; name: string }> }
export interface AdminRole { id: string; name: string; description?: string; permissions: string[] }
export interface AdminPermission { id: string; code: string; description?: string }
export interface AdminDepartment { id: string; code: string; name: string; createdAt: string; branches: Array<{ id: string; code: string; name: string }> }
export interface AuditEvent { id: string; action: string; entityType: string; entityId?: string; metadata?: unknown; createdAt: string; actor?: { id: string; username: string } }
export interface ApprovalInbox { estimates: Array<Record<string, unknown>>; expenses: Array<Record<string, unknown>>; bodyPaint: Array<Record<string, unknown>> }
export interface ApprovalRule { id: string; department: string; workflow: string; thresholdAmount: number; requiredRole: string; description: string; status: string }
export interface ProfitabilityReport {
  filter: ReportFilter
  basis: 'accrual' | 'cash'
  bookingsCount: number
  invoicedSales: number
  cashReceived: number
  outstandingReceivables: number
  invoicedVsCashDifference: number
  collectionsRate: number
  revenue: number
  directCosts: number
  grossProfit: number
  grossMarginPct: number
  operatingExpenses: number
  operatingProfit: number
  operatingMarginPct: number
  breakdown: {
    accrual: {
      revenue: number
      directCosts: number
      grossProfit: number
      grossMarginPct: number
      operatingExpenses: number
      operatingProfit: number
      operatingMarginPct: number
    }
    cash: {
      revenue: number
      directCosts: number
      grossProfit: number
      grossMarginPct: number
      operatingExpenses: number
      operatingProfit: number
      operatingMarginPct: number
    }
  }
}

function phase8Request<T>(token: string, path: string, options: RequestInit = {}) { return request<T>(path, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } }) }
function queryString(filter?: ReportFilter) { if (!filter) return ''; const query = new URLSearchParams(); Object.entries(filter).forEach(([key, value]) => value !== undefined && value !== '' && query.set(key, String(value))); return query.toString() ? `?${query}` : '' }
export const getReportingKpis = (token: string, filter?: ReportFilter) => phase8Request<ReportingKpis>(token, `/reporting/kpis${queryString(filter)}`)
export const getReportingSummary = (token: string, filter?: ReportFilter) => phase8Request<ReportSummary>(token, `/reporting/summary${queryString(filter)}`)
export const getReportingProfitability = (token: string, filter?: ReportFilter) => phase8Request<ProfitabilityReport>(token, `/reporting/profitability${queryString(filter)}`)
export const getReportingDrilldown = (token: string, source: string, filter?: ReportFilter) => phase8Request<PaginatedResponse<DrilldownRow> & { source: string }>(token, `/reporting/drilldown/${encodeURIComponent(source)}${queryString(filter)}`)
export const getReportingMetadata = (token: string) => phase8Request<ReportMetadata>(token, '/reporting/metadata')
export const exportReporting = (token: string, source: string, filter?: ReportFilter) => phase8Request<PaginatedResponse<DrilldownRow> & { format?: string; filename?: string; csv?: string }>(token, `/reporting/export/${encodeURIComponent(source)}`, { method: 'POST', body: JSON.stringify(filter ?? {}) })
export const getAdminUsers = (token: string, filter?: ReportFilter) => phase8Request<PaginatedResponse<AdminUser>>(token, `/admin/users${queryString(filter)}`)
export interface CreateAdminUserInput { username: string; email: string; password?: string; roleIds?: string[]; isActive?: boolean }
export const createAdminUser = (token: string, body: CreateAdminUserInput) => phase8Request<AdminUser>(token, '/admin/users', { method: 'POST', body: JSON.stringify(body) })
export const updateUserAccess = (token: string, id: string, body: { isActive?: boolean; roleIds?: string[] }) => phase8Request<AdminUser>(token, `/admin/users/${encodeURIComponent(id)}/access`, { method: 'POST', body: JSON.stringify(body) })
export const getAdminRoles = (token: string) => phase8Request<AdminRole[]>(token, '/admin/roles')
export const getAdminPermissions = (token: string) => phase8Request<AdminPermission[]>(token, '/admin/permissions')
export const getAdminDepartments = (token: string) => phase8Request<AdminDepartment[]>(token, '/admin/departments')
export const createAdminDepartment = (token: string, body: { code: string; name: string }) => phase8Request<AdminDepartment>(token, '/admin/departments', { method: 'POST', body: JSON.stringify(body) })
export const getAuditEvents = (token: string, filter?: ReportFilter) => phase8Request<PaginatedResponse<AuditEvent>>(token, `/admin/audit${queryString(filter)}`)
export const getAdminApprovalRules = (token: string) => phase8Request<ApprovalRule[]>(token, '/admin/approval-rules')
export const getApprovalInbox = (token: string, filter?: ReportFilter) => phase8Request<ApprovalInbox>(token, `/admin/approvals${queryString(filter)}`)
export const decideApproval = (token: string, kind: string, id: string, decision: 'APPROVE' | 'REJECT', notes?: string) => phase8Request<Record<string, unknown>>(token, `/admin/approvals/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision, notes }) })