import { Component, useEffect, useMemo, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react'
import { useAuth } from './auth'
import BodyPaintWorkspace from './BodyPaintWorkspace'
import FinanceWorkspace from './FinanceWorkspace'
import CashierWorkspace from './CashierWorkspace'
import { AdministrationWorkspace, DashboardWorkspace, ReportingWorkspace } from './Phase8Workspace'
import { createBooking, createCustomer, createLead, createVehicle, createEstimate, createJobCard, getParts, getPartCategories, createPart, createPartsBatch, getSalesResource, getStock, getLowStockAlerts, getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder, transferStock, adjustStock, getSuppliers, issueStock, receiveStock, returnStock, getMovements, getJobCards, updateJobCardStatus, recordLabor, recordInspection, requestParts, assignTechnician, getServicePackages, getServiceCheckEvents, recordServiceCheckEvent, getServiceWorkloadReport, getFinancialNotifications, getNotificationFeed, recordNotificationAsReceivable, createLeadActivity, createSalesInvoice, postSalesInvoice, createSalesPayment, createPaymentSchedule, getBookingRequests, decideBookingRequest, deliverSalesBooking, getSalesReports, createBookingRequest, type Part, type CreatePartInput, type SalesBooking, type SalesCustomer, type SalesData, type SalesLead, type SalesVehicle, type StockBalance, type StockCommand, type Supplier, type ServiceJobCard, type ServiceStatus, type FinancialNotification, type FeedNotificationItem, type StockMovementRecord, type SalesReport, type PurchaseOrder, type PartCategory, type ServicePackage } from './api'

type IconName = 'grid' | 'car' | 'clipboard' | 'wrench' | 'box' | 'users' | 'chart' | 'settings' | 'bell' | 'search' | 'plus' | 'arrow' | 'clock' | 'check' | 'alert' | 'refresh' | 'calendar' | 'filter' | 'x'
type State = 'ready' | 'loading' | 'empty' | 'error'

const iconPaths: Record<IconName, string> = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  car: 'M5 16l1.5-6h11L19 16M3 16h18M7 16v2m10-2v2M7 10l1.5-4h7L17 10M8 13h.01M16 13h.01',
  clipboard: 'M9 5h6M8 3h8v4H8zM6 5H4v16h16V5h-2M8 12h8M8 16h5',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.2 5.2L4 17a2.1 2.1 0 1 0 3 3l5.5-5.5a4 4 0 0 0 5.2-5.2l-3 3-2-2 3-3z',
  box: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10M7 5l9 4',
  users: 'M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 11a3 3 0 0 0-1-5.8M21 20v-1.5a4 4 0 0 0-3-3.8',
  chart: 'M4 19V5m0 14h17M8 16v-4m4 4V8m4 8V5m4 11v-7',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7.4-3.5a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 3.1a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2L4.6 14.5l2 3.4 2.3-1a7 7 0 0 0 1.7 1L11 21h4l.4-3.1a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 0-1z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  search: 'M20 20l-4.5-4.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2',
  check: 'M5 12l4 4L19 6',
  alert: 'M12 9v4m0 4h.01M10.3 3.5L2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3l-7.8-13.5a2 2 0 0 0-3.4 0z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4'
  ,calendar: 'M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1zM8 13h2m2 0h2m-6 4h2m2 0h2'
  ,filter: 'M4 6h16M7 12h10m-6 6h2'
  ,x: 'M6 6l12 12M18 6L6 18'
}

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]} /></svg>
}

type NavItem = { label: string; icon: IconName; count?: number }
const nav: NavItem[] = [
  { label: 'Overview', icon: 'grid' }, { label: 'Vehicle Sales', icon: 'car' },
  { label: 'Orders', icon: 'clipboard' }, { label: 'Workshop / Service', icon: 'wrench' }, { label: 'Body & Paint', icon: 'car' },
  { label: 'Spare Parts', icon: 'box' }, { label: 'Cashier', icon: 'chart' }, { label: 'Accounts & Finance', icon: 'chart' }, { label: 'Customers', icon: 'users' }, { label: 'Reports', icon: 'chart' }
]
const approvals: Array<{ type: string; ref: string; customer: string; value: string; age: string; tone: string }> = []
const activity: Array<{ code: string; title: string; detail: string; time: string; color: string }> = []

function Status({ state, children }: { state: State; children: ReactNode }) {
  if (state === 'loading') return <div className="state-message"><span className="spinner" /> Loading data…</div>
  if (state === 'empty') return <div className="state-message"><Icon name="box" size={22} /><span>No records to display</span><small>New activity will appear here.</small></div>
  if (state === 'error') return <div className="state-message error-state"><Icon name="alert" size={22} /><span>Couldn’t load this panel</span><button className="text-button"><Icon name="refresh" size={14} /> Try again</button></div>
  return <>{children}</>
}

interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Workspace crash caught by ErrorBoundary:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="state-message error-state" style={{ margin: '40px auto', maxWidth: '640px', textAlign: 'center' }}>
          <Icon name="alert" size={32} />
          <h2>Couldn’t load this workspace</h2>
          <p>{this.state.error?.message || 'An unexpected rendering error occurred.'}</p>
          <button className="primary-button" onClick={() => this.setState({ hasError: false, error: null })}>
            <Icon name="refresh" size={15} /> Reload workspace
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const money = (value?: number | string | null) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`

function AuthenticatedApp({ user, signOut }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; signOut: () => void }) {
  const [active, setActive] = useState('Overview')
  const [state, setState] = useState<State>('ready')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifications, setNotifications] = useState<FeedNotificationItem[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifRefresh, setNotifRefresh] = useState(0)
  const [financeNotifTab, setFinanceNotifTab] = useState<'ALL' | 'SALES' | 'SERVICE' | 'BODY_PAINT'>('ALL')

  const initials = user.username.slice(0, 2).toUpperCase()
  const displayName = user.username.replace(/[._-]/g, ' ')
  const salesView = active === 'Vehicle Sales' || active === 'Customers' || active === 'Orders'

  const userPerms = user.permissions || []
  const hasPerm = (prefix: string) => userPerms.some(p => p === prefix || p.startsWith(prefix))

  // Role detection — strictly based on permissions, never bleed across departments
  const isDirectorOrAdmin = user.roles.some(r =>
    r.toLowerCase().includes('director') ||
    r.toLowerCase().includes('administrator') ||
    r.toLowerCase().includes('system admin')
  ) || userPerms.includes('users.manage')

  const isFinanceUser = !isDirectorOrAdmin && (
    hasPerm('finance.') ||
    user.roles.some(r => r.toLowerCase().includes('account') && !r.toLowerCase().includes('director'))
  )
  const isDirectorFinance = isDirectorOrAdmin || isFinanceUser

  const isSalesOnly = !isDirectorOrAdmin && !isFinanceUser && (hasPerm('sales.') || hasPerm('sales.booking') || hasPerm('sales.vehicle') || hasPerm('sales.lead'))
  const isServiceOnly = !isDirectorOrAdmin && !isFinanceUser && hasPerm('service.')
  const isBodyPaintOnly = !isDirectorOrAdmin && !isFinanceUser && hasPerm('bodypaint.')
  const isPartsOnly = !isDirectorOrAdmin && !isFinanceUser && !isSalesOnly && !isServiceOnly && !isBodyPaintOnly && (hasPerm('parts.') || hasPerm('inventory.'))
  const isCashierOnly = !isDirectorOrAdmin && !isFinanceUser && hasPerm('cashier.') && !hasPerm('finance.') && !hasPerm('sales.') && !hasPerm('service.') && !hasPerm('bodypaint.')

  // Map role to department filter for the feed API
  const deptFilter: string | undefined = (() => {
    if (isDirectorFinance) return undefined // Director/Finance sees all
    if (isSalesOnly) return 'SALES'
    if (isServiceOnly) return 'SERVICE'
    if (isBodyPaintOnly) return 'BODY_PAINT'
    if (isPartsOnly) return 'PARTS'
    if (isCashierOnly) return 'CASHIER'
    return undefined
  })()

  useEffect(() => {
    let mounted = true
    const token = userToken()
    if (!token) { setNotifications([]); return }
    getNotificationFeed(token, deptFilter)
      .then(res => {
        if (mounted && Array.isArray(res)) setNotifications(res)
      })
      .catch(() => { if (mounted) setNotifications([]) })
    return () => { mounted = false }
  }, [user.username, notifRefresh, deptFilter])

  // For Finance/Director: count unrecorded billing items. For other roles: count all high-priority items.
  const urgentCount = isDirectorFinance
    ? notifications.filter(n => n.department === 'FINANCE' && n.isRecorded === false).length
    : notifications.filter(n => n.priority === 'HIGH').length

  async function handleRecordFromDrawer(item: FeedNotificationItem) {
    const token = userToken()
    if (!token || !item.sourceType || !item.sourceId) return
    try {
      await recordNotificationAsReceivable(token, {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        amount: item.amount ?? 0,
        customerId: item.customerId,
        referenceNo: item.referenceNo ?? '',
        description: item.title,
      })
      setNotifRefresh(v => v + 1)
    } catch (e) {
      console.error(e)
    }
  }

  // For director/finance: filter the feed by selected tab
  const visibleNotifications = isDirectorFinance && financeNotifTab !== 'ALL'
    ? notifications.filter(n => n.department === financeNotifTab || (financeNotifTab === 'BODY_PAINT' && n.department === 'BODY_PAINT'))
    : notifications

  const availableNav = useMemo(() => {
    return nav.filter(item => {
      if (item.label === 'Overview') return hasPerm('reporting.dashboard.read')
      if (item.label === 'Vehicle Sales' || item.label === 'Orders') return hasPerm('sales.booking') || hasPerm('sales.vehicle') || hasPerm('sales.lead')
      if (item.label === 'Workshop / Service') return hasPerm('service.jobcard')
      if (item.label === 'Body & Paint') return hasPerm('bodypaint.repair-order')
      if (item.label === 'Spare Parts') return hasPerm('parts.') || hasPerm('inventory.')
      if (item.label === 'Cashier') return hasPerm('cashier.')
      if (item.label === 'Accounts & Finance') return hasPerm('finance.')
      if (item.label === 'Customers') return hasPerm('sales.customer')
      if (item.label === 'Reports') return hasPerm('reporting.report')
      return true
    })
  }, [user.permissions])

  const canAdmin = userPerms.includes('users.manage')

  const defaultTab = useMemo(() => {
    if (userPerms.includes('cashier.session.open') && !userPerms.includes('sales.booking.create') && !userPerms.includes('finance.journal.post')) {
      return 'Cashier'
    }
    if (userPerms.includes('sales.booking.read') && !userPerms.includes('finance.journal.post') && !userPerms.includes('reporting.dashboard.read')) {
      return 'Vehicle Sales'
    }
    if (userPerms.includes('service.jobcard.read') && !userPerms.includes('finance.journal.post') && !userPerms.includes('reporting.dashboard.read')) {
      return 'Workshop / Service'
    }
    if (userPerms.includes('bodypaint.repair-order.read') && !userPerms.includes('finance.journal.post') && !userPerms.includes('reporting.dashboard.read')) {
      return 'Body & Paint'
    }
    if (userPerms.includes('parts.read') && !userPerms.includes('finance.journal.post') && !userPerms.includes('reporting.dashboard.read')) {
      return 'Spare Parts'
    }
    if (userPerms.includes('finance.journal.post') && !userPerms.includes('reporting.dashboard.read')) {
      return 'Accounts & Finance'
    }
    if (availableNav.some(i => i.label === 'Overview')) return 'Overview'
    if (availableNav.length > 0) return availableNav[0].label
    if (canAdmin) return 'Administration'
    return 'Overview'
  }, [userPerms, availableNav, canAdmin])

  useEffect(() => {
    setActive(defaultTab)
  }, [user.username, defaultTab])

  useEffect(() => {
    const isPermitted = availableNav.some(item => item.label === active) || (active === 'Administration' && canAdmin)
    if (!isPermitted && defaultTab && active !== defaultTab) {
      setActive(defaultTab)
    }
  }, [active, availableNav, canAdmin, defaultTab])

  return <div className="app-shell" onClick={() => notificationsOpen && setNotificationsOpen(false)}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">G</div><div><strong>GATEWAY</strong><span>MOTORS</span></div></div>
      <div className="workspace-switcher"><span className="status-dot" /> Main dealership <span className="chevron">⌄</span></div>
      <nav className="nav-list" aria-label="Main navigation">
        <p className="nav-heading">WORKSPACE</p>{availableNav.map(item => <button key={item.label} className={`nav-item ${active === item.label ? 'active' : ''}`} onClick={() => setActive(item.label)}><Icon name={item.icon} /><span>{item.label}</span>{item.count && <b>{item.count}</b>}</button>)}
        {canAdmin && <>
          <p className="nav-heading nav-heading-bottom">ADMINISTRATION</p>
          <button className={`nav-item ${active === 'Administration' ? 'active' : ''}`} onClick={() => setActive('Administration')}><Icon name="settings" /><span>Administration</span></button>
        </>}
      </nav>
      <div className="sidebar-footer"><div className="help-icon">?</div><div><strong>Need a hand?</strong><span>Open support centre</span></div><Icon name="arrow" size={15} /></div>
       <div className="user-card"><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>{user.roles[0] ?? 'Team member'}</span></div><button className="user-menu" onClick={signOut} title="Sign out" aria-label="Sign out">↪</button></div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div className="mobile-brand"><div className="brand-mark">G</div><strong>GATEWAY MOTORS</strong></div>
        <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{active}</strong></div>
        <div className="top-actions">
          <button className="search-button" aria-label="Search" onClick={() => setSearchOpen(v => !v)}>
            <Icon name="search" size={19} />{searchOpen && <input autoFocus placeholder="Search DMS…" aria-label="Search DMS" />}
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="icon-button notification"
              aria-label="Notifications"
              onClick={(e) => { e.stopPropagation(); setNotificationsOpen(v => !v) }}
              title={urgentCount > 0 ? `${urgentCount} urgent alert${urgentCount > 1 ? 's' : ''} require attention` : 'Notifications'}
            >
              <Icon name="bell" size={19} />
              {urgentCount > 0 && (
                <span className="notification-badge">{urgentCount}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className="notification-drawer" onClick={e => e.stopPropagation()}>
                <div className="notification-drawer-header">
                  <div>
                    <h3>
                      {isDirectorOrAdmin ? 'All Departments - Alerts' :
                       isFinanceUser ? 'Finance and Billing Alerts' :
                       isSalesOnly ? 'Sales Notifications' :
                       isServiceOnly ? 'Workshop Notifications' :
                       isBodyPaintOnly ? 'Body and Paint Notifications' :
                       isPartsOnly ? 'Parts and Inventory Alerts' :
                       isCashierOnly ? 'Cashier Notifications' :
                       'Notifications'}
                    </h3>
                    <p>
                      {urgentCount > 0
                        ? `${urgentCount} item${urgentCount > 1 ? 's' : ''} require${urgentCount === 1 ? 's' : ''} attention`
                        : 'All caught up - no action items pending'}
                    </p>
                  </div>
                  <button className="modal-close" onClick={() => setNotificationsOpen(false)} aria-label="Close">x</button>
                </div>
                {isDirectorFinance && (
                  <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                    {(['ALL', 'SALES', 'SERVICE', 'BODY_PAINT'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFinanceNotifTab(tab)}
                        style={{
                          padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '12px', border: '1px solid',
                          borderColor: financeNotifTab === tab ? '#1d4ed8' : '#cbd5e1',
                          background: financeNotifTab === tab ? '#1d4ed8' : 'white',
                          color: financeNotifTab === tab ? 'white' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {tab === 'ALL' ? 'All' : tab === 'BODY_PAINT' ? 'Body & Paint' : tab === 'SERVICE' ? 'Service' : 'Sales'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="notification-drawer-body">
                  {visibleNotifications.length === 0 ? (
                    <div className="empty-notifications" style={{ padding: '28px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: '32px', marginBottom: '10px' }}>&#10003;</div>
                      <strong style={{ display: 'block', fontSize: '15px', color: '#0f172a', marginBottom: '6px' }}>
                        No pending alerts
                      </strong>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                        {isSalesOnly ? 'All vehicle sales orders and bookings are up to date.' :
                         isServiceOnly ? 'All workshop job cards are running normally.' :
                         isBodyPaintOnly ? 'All paint and body repair orders are on schedule.' :
                         isPartsOnly ? 'All stock levels and inventories are current.' :
                         isCashierOnly ? 'No cashier session issues to report.' :
                         'All departments are caught up.'}
                      </p>
                    </div>
                  ) : (
                    visibleNotifications.map(n => {
                      const deptEmoji =
                        n.department === 'SALES' ? '\uD83D\uDE97' :
                        n.department === 'SERVICE' ? '\uD83D\uDD27' :
                        n.department === 'BODY_PAINT' ? '\uD83C\uDFA8' :
                        n.department === 'PARTS' ? '\uD83D\uDCE6' :
                        n.department === 'CASHIER' ? '\uD83D\uDCB5' :
                        n.department === 'FINANCE' ? '\uD83D\uDCCA' : '\uD83D\uDD14'
                      const isHighPriority = n.priority === 'HIGH'
                      const isFinanceBillingItem = n.department === 'FINANCE' && !!n.sourceType && n.isRecorded === false
                      return (
                        <div
                          key={n.id}
                          className={`notification-item ${isHighPriority ? 'unrecorded' : 'recorded'}`}
                          style={{ borderLeft: `3px solid ${isHighPriority ? '#ef4444' : '#94a3b8'}` }}
                        >
                          <div className="notification-icon">{deptEmoji}</div>
                          <div className="notification-details">
                            {isDirectorFinance && n.departmentLabel && (
                              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.5px', display: 'block', marginBottom: '2px' }}>
                                {n.departmentLabel}
                              </span>
                            )}
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <div className="notification-meta">
                              {n.referenceNo && <span className="notif-ref">{n.referenceNo}</span>}
                              {n.amount !== undefined && n.amount > 0 && (
                                <span className="notif-amount">{money(n.amount)}</span>
                              )}
                              {n.status && (
                                <span className={`notif-status ${isHighPriority ? 'pending' : 'recorded'}`}>
                                  {n.status.replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          {isFinanceBillingItem && isDirectorFinance && (
                            <button
                              className="record-button"
                              onClick={() => handleRecordFromDrawer(n)}
                              title="Record into Accounts Receivable"
                            >
                              + Record
                            </button>
                          )}
                          {n.actionWorkspace && !isFinanceBillingItem && (
                            <button
                              className="record-button"
                              style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
                              onClick={() => { setNotificationsOpen(false); setActive(n.actionWorkspace!) }}
                              title={`Go to ${n.actionWorkspace}`}
                            >
                              Open
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
                {isDirectorFinance && (
                  <div className="notification-drawer-footer">
                    <button
                      className="primary-button"
                      onClick={() => { setNotificationsOpen(false); setActive('Accounts & Finance') }}
                    >
                      Open in Accounts &amp; Finance
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="top-avatar">{initials}</div>
        </div>
      </header>
       <div className="page-content">
        <ErrorBoundary key={active}>
          {salesView ? (
            <SalesWorkspace
              key={active}
              token={userToken()}
              initialTab={active === 'Orders' ? 'bookings' : active === 'Customers' ? 'customers' : 'vehicles'}
              activeNav={active}
            />
          ) : active === 'Spare Parts' && (hasPerm('parts.') || hasPerm('inventory.')) ? <PartsWorkspace token={userToken()} /> : active === 'Workshop / Service' && hasPerm('service.jobcard') ? <ServiceWorkspace token={userToken()} /> : active === 'Body & Paint' && hasPerm('bodypaint.repair-order') ? <BodyPaintWorkspace token={userToken()} /> : active === 'Accounts & Finance' && isFinanceUser ? <FinanceWorkspace token={userToken()} permissions={user.permissions} /> : active === 'Cashier' && hasPerm('cashier.') ? <CashierWorkspace token={userToken()} permissions={user.permissions} /> : active === 'Reports' && hasPerm('reporting.report') ? <ReportingWorkspace token={userToken()} permissions={user.permissions} /> : active === 'Administration' && canAdmin ? <AdministrationWorkspace token={userToken()} permissions={user.permissions} currentUserId={user.id} /> : active === 'Overview' && hasPerm('reporting.dashboard.read') ? <DashboardWorkspace token={userToken()} permissions={user.permissions} /> : <>
          <section className="page-intro"><div><p className="eyebrow">THURSDAY, 24 OCTOBER 2024 <span className="live-pill"><i /> LIVE</span></p><h1>Good morning, {displayName.split(' ')[0]} <span>✦</span></h1><p className="subtitle">Here’s what’s happening across your dealership today.</p></div><button className="primary-button"><Icon name="plus" size={17} /> New transaction <span className="button-caret">⌄</span></button></section>
          <div className="demo-controls"><span>Panel state</span>{(['ready', 'loading', 'empty', 'error'] as State[]).map(option => <button key={option} className={state === option ? 'selected' : ''} onClick={() => setState(option)}>{option}</button>)}</div>
           <section className="kpi-grid"><Kpi icon="car" label="Vehicles in stock" value="0" delta="0%" context="current" tone="blue" /><Kpi icon="chart" label="Monthly revenue" value="Rs. 0" delta="0%" context="current" tone="amber" /><Kpi icon="wrench" label="Open work orders" value="0" delta="0%" context="current" tone="purple" /><Kpi icon="users" label="Active customers" value="0" delta="0%" context="current" tone="green" /></section>
           <section className="dashboard-grid"><article className="panel operations-panel"><PanelHeader title="Operations overview" meta="This month" /><Status state={state}><div className="operations-content"><div className="donut-wrap"><div className="donut"><div><strong>0</strong><span>Total jobs</span></div></div><div className="donut-legend"><Legend color="blue" label="Sales orders" value="0" percent="0%" /><Legend color="amber" label="Workshop jobs" value="0" percent="0%" /><Legend color="purple" label="Parts orders" value="0" percent="0%" /></div></div><div className="bar-chart"><div className="chart-label"><span>Revenue performance</span><strong>Rs. 0</strong></div><div className="bars">{[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((height, i) => <div className="bar-column" key={i}><div className={`bar ${i === 11 ? 'current' : ''}`} style={{ height: `${height}%` }} /><small>{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</small></div>)}</div></div></div></Status></article>
           <article className="panel approvals-panel"><PanelHeader title="Pending approvals" action="View all" /><Status state={state}><div className="approval-list">{approvals.length ? approvals.map(row => <div className="approval-row" key={row.ref}><div className={`approval-icon ${row.tone}`}><Icon name={row.type === 'Parts requisition' ? 'box' : row.type === 'Discount request' ? 'clipboard' : 'car'} size={17} /></div><div className="approval-main"><strong>{row.type} <em>{row.ref}</em></strong><span>{row.customer}</span></div><div className="approval-value"><strong>{row.value}</strong><span><Icon name="clock" size={12} /> {row.age}</span></div></div>) : <div className="sales-state" style={{ padding: '24px 0' }}><Icon name="clipboard" size={20} /><strong>No pending approvals</strong><span>Approvals requiring review will appear here.</span></div>}</div></Status></article></section>
          <section className="lower-grid"><article className="panel activity-panel"><PanelHeader title="Recent activity" action="View activity" /><Status state={state}><div className="activity-list">{activity.length ? activity.map(item => <div className="activity-row" key={item.title}><div className={`activity-code ${item.color}`}>{item.code}</div><div><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>) : <div className="sales-state" style={{ padding: '24px 0' }}><Icon name="clock" size={20} /><strong>No recent activity</strong><span>Recent actions and operations will appear here.</span></div>}</div></Status></article><article className="panel workshop-panel"><PanelHeader title="Workshop capacity" action="Manage bays" /><Status state={state}><div className="capacity-summary"><div><strong>0%</strong><span>Booked today</span></div><span className="capacity-note"><Icon name="check" size={14} /> All bays available</span></div><div className="progress-track"><div style={{ width: '0%' }} /></div><div className="bay-list"><span><i className="bay-dot open" /> 8 bays available</span><span><i className="bay-dot busy" /> 0 bays occupied</span></div><div className="parts-callout"><div className="parts-icon"><Icon name="box" size={17} /></div><div><strong>Parts desk attention</strong><span>0 items below reorder point</span></div><Icon name="arrow" size={16} /></div></Status></article></section>
          </>}
        </ErrorBoundary>
       </div>
    </main>
  </div>
}


function App() {
  const { user, isLoading, signOut } = useAuth()
  if (isLoading) return <div className="auth-loading"><span className="spinner" /> Checking session…</div>
  if (!user) return <LoginScreen />
  return <AuthenticatedApp user={user} signOut={signOut} />
}

function userToken() { return localStorage.getItem('gateway_access_token') }

const demoSales: SalesData = {
  customers: [],
  vehicles: [],
  leads: [],
  bookings: [],
}

type SalesTab = keyof SalesData
function normalizeSalesResource(resource: SalesTab, rows: unknown[]): SalesData[SalesTab] {
  return rows.map(raw => {
    const row = raw as Record<string, unknown>
    const id = String(row.id ?? '')
    if (resource === 'customers') {
      const customerCode = String(row.sourceId || (row as any).customerCode || '')
      return { id, customerCode: customerCode || undefined, name: String(row.name ?? 'Unnamed customer'), company: row.company ? String(row.company) : undefined, email: String(row.email ?? '—'), phone: String(row.phone ?? '—'), status: 'Active', lastActivity: row.updatedAt ? new Date(String(row.updatedAt)).toLocaleDateString() : 'Recently added' } satisfies SalesCustomer
    }
    if (resource === 'vehicles') {
      const parsedNum = row.price ? Number(row.price) : (row.sourceType === 'SALE_PRICE' || (row.sourceId && /^\d+(\.\d+)?$/.test(String(row.sourceId)))) ? Number(row.sourceId) : null
      const formattedPrice = parsedNum !== null && !isNaN(parsedNum) ? `Rs. ${parsedNum.toLocaleString('en-PK')}` : (row.price ? String(row.price) : 'Price on request')
      const vehicleName = row.name ? String(row.name) : [row.modelYear, row.make, row.model].filter(Boolean).join(' ') || 'Vehicle'
      const statusRaw = String(row.status || '').toUpperCase()
      const status = statusRaw === 'SOLD' ? 'Sold' : (statusRaw === 'RESERVED' ? 'Reserved' : 'Available')
      return {
        id,
        name: vehicleName,
        stockNumber: String(row.registrationNo ?? row.vin ?? id),
        price: formattedPrice,
        status: status as 'Available' | 'Reserved' | 'Sold',
        age: row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : 'Recently added'
      } satisfies SalesVehicle
    }
    if (resource === 'leads') {
      const ownerName = (row as any).ownerName || (row as any).owner?.username || (row as any).ownerId || 'Unassigned'
      return { id, name: String(row.name ?? 'Unnamed lead'), interest: String(row.interest ?? 'Vehicle enquiry'), source: String(row.sourceType ?? 'Direct'), owner: String(ownerName), status: row.status === 'QUALIFIED' ? 'Qualified' : row.status === 'CONTACTED' ? 'Contacted' : 'New', created: row.createdAt ? new Date(String(row.createdAt)).toLocaleDateString() : 'Recently added' } satisfies SalesLead
    }
    const customerObj = (row as any).customer
    const vehicleObj = (row as any).vehicle
    const rawCustName = (row as any).customerName || (customerObj ? customerObj.name : undefined) || ((row as any).notes?.startsWith('Customer: ') ? (row as any).notes.replace('Customer: ', '') : undefined) || (row as any).customerId || 'Customer'
    const rawCustCode = (row as any).customerCode || (customerObj?.sourceId)
    const fullCustomer = rawCustCode ? `${rawCustName} (${rawCustCode})` : String(rawCustName)
    const vehicleName = (row as any).vehicleName || (vehicleObj ? [vehicleObj.modelYear, vehicleObj.make, vehicleObj.model].filter(Boolean).join(' ') + (vehicleObj.registrationNo ? ` (${vehicleObj.registrationNo})` : '') : undefined) || (row as any).vehicleId || 'Vehicle'
     const bookingStatus = row.status === 'COMPLETED' ? 'Completed' : row.status === 'DELIVERED' ? 'Delivered' : row.status === 'INVOICED' ? 'Invoiced' : row.status === 'CONFIRMED' ? 'Confirmed' : row.status === 'CANCELLED' ? 'Cancelled' : row.status === 'RESERVED' ? 'Reserved' : 'Pending'
    return { id, customer: fullCustomer, vehicle: String(vehicleName), date: row.bookingDate ? new Date(String(row.bookingDate)).toLocaleDateString() : 'Date to confirm', time: row.bookingDate ? new Date(String(row.bookingDate)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', status: bookingStatus } satisfies SalesBooking
  }) as SalesData[SalesTab]
}

function SalesWorkspace({ token, initialTab, activeNav }: { token: string | null; initialTab: SalesTab; activeNav?: string }) {
  const [tab, setTab] = useState<SalesTab>(initialTab)
  const [data, setData] = useState<SalesData>(demoSales)
  const [loading, setLoading] = useState(true)
  const [fallback, setFallback] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddLead, setShowAddLead] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token) { setLoading(false); setFallback(true); return () => { mounted = false } }
    Promise.all((Object.keys(demoSales) as SalesTab[]).map(async resource => [resource, await getSalesResource<unknown>(token, resource)] as const))
      .then(results => { if (!mounted) return; const next = { ...demoSales }; results.forEach(([resource, rows]) => { Object.assign(next, { [resource]: normalizeSalesResource(resource, rows) }) }); setData(next); setFallback(false) })
      .catch(() => { if (mounted) { setData(demoSales); setFallback(true) } })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [token, refreshKey])

  const rows = useMemo(() => data[tab].filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()) && (status === 'All statuses' || Object.values(row).includes(status))), [data, query, status, tab])
  const labels: Record<SalesTab, string> = { customers: 'Customers', vehicles: 'Vehicles', leads: 'Leads', bookings: 'Orders / Bookings' }
  return <>
    <section className="page-intro sales-intro">
      <div>
        <p className="eyebrow">SALES WORKSPACE <span className="live-pill"><i /> LIVE</span></p>
        <h1>{activeNav === 'Orders' ? 'Vehicle orders & bookings' : activeNav === 'Customers' ? 'Customer directory' : 'Sales pipeline'}</h1>
        <p className="subtitle">{activeNav === 'Orders' ? 'Manage customer vehicle purchase orders, allocations and showroom bookings.' : activeNav === 'Customers' ? 'Manage customer profiles and account records.' : 'Manage vehicle inventory, customer enquiries, showroom leads and sale bookings.'}</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {activeNav === 'Orders' ? (
          <>
            <button className="primary-button" onClick={() => setShowBooking(true)}>
              <Icon name="calendar" size={16} /> New vehicle order / booking
            </button>
            <button className="secondary-button" onClick={() => setShowAddCustomer(true)}>
              <Icon name="users" size={16} /> New customer
            </button>
          </>
        ) : (
          <>
            <button className="primary-button" onClick={() => setShowAddVehicle(true)}>
              <Icon name="plus" size={17} /> Add vehicle to stock
            </button>
            <button className="secondary-button" onClick={() => setShowAddCustomer(true)}>
              <Icon name="users" size={16} /> New customer
            </button>
            <button className="secondary-button" onClick={() => setShowAddLead(true)}>
              <Icon name="clipboard" size={16} /> New lead
            </button>
            <button className="secondary-button" onClick={() => setShowBooking(true)}>
              <Icon name="calendar" size={16} /> New booking
            </button>
          </>
        )}
      </div>
    </section>
    <div className="sales-summary">
      <div>
        <strong>Sales & Inventory Overview</strong>
        <span>{fallback ? 'Demo data · API unavailable' : 'Connected to live sales inventory'}</span>
      </div>
      <div className="sales-summary-stats">
        <span><b>{data.vehicles.length}</b> vehicles in stock</span>
        <span><b>{data.customers.length}</b> customers</span>
        <span><b>{data.leads.length}</b> active leads</span>
        <span><b>{data.bookings.length}</b> bookings</span>
      </div>
    </div>
    {notice && (
      <div className="success-banner" style={{ margin: '16px 0' }}>
        <Icon name="check" size={16} /> <span>{notice}</span>
        <button onClick={() => setNotice('')} aria-label="Dismiss" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
          <Icon name="x" size={14} />
        </button>
      </div>
    )}
    {fallback && <div className="demo-banner"><Icon name="alert" size={16} /><span><strong>Demo fallback active.</strong> Your API is unavailable, so this workspace is showing sample dealership records.</span><button onClick={() => setRefreshKey(key => key + 1)}><Icon name="refresh" size={14} /> Retry connection</button></div>}
    <section className="sales-panel panel">
      <div className="sales-tabs">{(Object.keys(labels) as SalesTab[]).map(item => <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setQuery(''); setStatus('All statuses') }} key={item}>{labels[item]} <span>{data[item].length}</span></button>)}</div>
      <div className="sales-toolbar">
        <label className="sales-search"><Icon name="search" size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${labels[tab].toLowerCase()}…`} /></label>
        <label className="status-filter"><Icon name="filter" size={15} /><select value={status} onChange={event => setStatus(event.target.value)}><option>All statuses</option><option>Active</option><option>Available</option><option>Reserved</option><option>Sold</option><option>New</option><option>Contacted</option><option>Qualified</option><option>Confirmed</option><option>Pending</option><option>Completed</option></select></label>
        <button className="filter-button"><Icon name="calendar" size={15} /> Last 30 days</button>
      </div>
      {loading ? <div className="sales-state"><span className="spinner" /><strong>Loading sales data…</strong><span>Connecting to your dealership workspace.</span></div> : rows.length === 0 ? <div className="sales-state"><Icon name="search" size={23} /><strong>No {labels[tab].toLowerCase()} found</strong><span>Try a different search or click "+ Add {tab === 'vehicles' ? 'vehicle to stock' : tab === 'customers' ? 'customer' : tab === 'leads' ? 'lead' : 'booking'}" to add one.</span><button className="text-button" onClick={() => { setQuery(''); setStatus('All statuses') }}>Clear filters</button></div> : <SalesRows tab={tab} rows={rows} />}
     </section>

     <SalesOperationsPanel token={token} bookings={data.bookings} leads={data.leads} onDone={(message) => { setNotice(message); setRefreshKey(key => key + 1) }} />

     {showAddVehicle && (
      <AddVehicleModal
        token={token}
        onClose={() => setShowAddVehicle(false)}
        onDone={(msg) => {
          setShowAddVehicle(false)
          setNotice(msg)
          setTab('vehicles')
          setRefreshKey(key => key + 1)
        }}
      />
    )}

    {showAddCustomer && (
      <AddCustomerModal
        token={token}
        onClose={() => setShowAddCustomer(false)}
        onDone={(msg) => {
          setShowAddCustomer(false)
          setNotice(msg)
          setTab('customers')
          setRefreshKey(key => key + 1)
        }}
      />
    )}

    {showAddLead && (
      <AddLeadModal
        token={token}
        onClose={() => setShowAddLead(false)}
        onDone={(msg) => {
          setShowAddLead(false)
          setNotice(msg)
          setTab('leads')
          setRefreshKey(key => key + 1)
        }}
      />
    )}

    {showBooking && (
      <BookingModal
        token={token}
        vehicles={data.vehicles}
        customers={data.customers}
        onClose={() => setShowBooking(false)}
        onDone={() => {
          setShowBooking(false)
          setNotice('Booking created successfully!')
          setTab('bookings')
          setRefreshKey(key => key + 1)
        }}
      />
    )}
  </>
}

function SalesOperationsPanel({ token, bookings, leads, onDone }: { token: string | null; bookings: SalesBooking[]; leads: SalesLead[]; onDone: (message: string) => void }) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id || '')
  const [leadId, setLeadId] = useState(leads[0]?.id || '')
  const [activity, setActivity] = useState('')
  const [amount, setAmount] = useState('')
  const [report, setReport] = useState<SalesReport | null>(null)
  const [pendingRequest, setPendingRequest] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bookingId && bookings[0]) setBookingId(bookings[0].id)
    if (!leadId && leads[0]) setLeadId(leads[0].id)
  }, [bookings, leads, bookingId, leadId])

  useEffect(() => {
    if (!token || !bookingId) { setPendingRequest(null); return }
    getBookingRequests(token, bookingId).then(rows => setPendingRequest(rows.find((row: any) => row.status === 'PENDING') || null)).catch(() => setPendingRequest(null))
  }, [token, bookingId])

  async function run(action: () => Promise<unknown>, message: string) {
    if (!token) return
    setBusy(true); setError('')
    try { await action(); onDone(message) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sales action failed.') } finally { setBusy(false) }
  }

  return <section className="panel" style={{ marginTop: '16px', padding: '18px' }}>
    <div className="panel-header"><div><p className="eyebrow">PHASE 2 CONTROLS</p><h2 style={{ margin: 0 }}>Sales lifecycle actions</h2><p className="subtitle">Follow-ups, accounting handoff, payments, delivery and controlled booking changes.</p></div><button className="secondary-button" onClick={() => token && getSalesReports(token).then(setReport).catch(e => setError(e.message))}>Refresh sales report</button></div>
    <div className="form-row" style={{ marginTop: '14px' }}>
      <label>Lead follow-up<select value={leadId} onChange={e => setLeadId(e.target.value)}><option value="">Select lead</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name} · {lead.status}</option>)}</select></label>
      <label>Follow-up note<input value={activity} onChange={e => setActivity(e.target.value)} placeholder="Call customer about vehicle allocation" /></label>
      <button className="secondary-button" disabled={busy || !leadId || !activity.trim()} onClick={() => run(() => createLeadActivity(token!, leadId, { type: 'FOLLOW_UP', notes: activity.trim() }), 'Lead follow-up saved.')}>Save follow-up</button>
    </div>
    <div className="form-row" style={{ marginTop: '12px' }}>
      <label>Booking<select value={bookingId} onChange={e => setBookingId(e.target.value)}><option value="">Select booking</option>{bookings.map(booking => <option key={booking.id} value={booking.id}>{booking.customer} · {booking.vehicle} · {booking.status}</option>)}</select></label>
      <label>Payment amount<input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Deposit / installment" /></label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
        <button className="secondary-button" disabled={busy || !bookingId} onClick={() => run(async () => { const invoice = await createSalesInvoice(token!, bookingId); if ((invoice as any)?.id) await postSalesInvoice(token!, (invoice as any).id) }, 'Vehicle invoice posted to Accounts.')}>Invoice &amp; post</button>
        <button className="secondary-button" disabled={busy || !bookingId || !amount} onClick={() => run(() => createSalesPayment(token!, bookingId, { amount: Number(amount), paymentMethod: 'CASH', reference: 'Sales workspace payment' }), 'Sales payment recorded and posted.')}>Record payment</button>
        <button className="secondary-button" disabled={busy || !bookingId || !amount} onClick={() => run(() => createPaymentSchedule(token!, bookingId, [{ installmentNo: 1, dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), amount: Number(amount) }]), 'Payment schedule saved.')}>Save schedule</button>
        <button className="primary-button" disabled={busy || !bookingId} onClick={() => run(() => deliverSalesBooking(token!, bookingId, { deliveredTo: 'Customer' }), 'Vehicle delivery recorded.')}>Deliver vehicle</button>
        <button className="secondary-button" disabled={busy || !bookingId} onClick={() => run(() => createBookingRequest(token!, bookingId, { type: 'CANCELLATION', reason: 'Customer requested cancellation from Sales workspace.' }), 'Cancellation request submitted for approval.')}>Request cancellation</button>
      </div>
    </div>
    {pendingRequest && <div className="success-banner" style={{ marginTop: '12px' }}><span><strong>{pendingRequest.type}</strong> request pending · {pendingRequest.reason}</span><div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}><button className="secondary-button" disabled={busy} onClick={() => run(async () => { await decideBookingRequest(token!, pendingRequest.id, 'REJECTED', 'Rejected from Sales workspace'); setPendingRequest(null) }, 'Booking request rejected.')}>Reject</button><button className="primary-button" disabled={busy} onClick={() => run(async () => { await decideBookingRequest(token!, pendingRequest.id, 'APPROVED', 'Approved from Sales workspace'); setPendingRequest(null) }, 'Booking request approved.')}>Approve</button></div></div>}
    {error && <p className="form-error" style={{ marginTop: '12px' }}><Icon name="alert" size={14} /> {error}</p>}
    {report && <div className="sales-summary" style={{ marginTop: '14px' }}><span><b>{report.leads}</b> leads · <b>{report.conversionRate}%</b> conversion</span><span><b>{report.bookings}</b> bookings · <b>{report.cancellations}</b> cancellations · <b>{report.deliveries}</b> deliveries</span><span><b>{money(report.invoicedAmount)}</b> invoiced · <b>{money(report.receivedAmount)}</b> received</span></div>}
  </section>
}

function SalesRows({ tab, rows }: { tab: SalesTab; rows: Array<SalesCustomer | SalesVehicle | SalesLead | SalesBooking> }) {
  return <div className="sales-table"><div className="sales-table-head"><span>{tab === 'customers' ? 'Customer' : tab === 'vehicles' ? 'Vehicle' : tab === 'leads' ? 'Lead' : 'Booking'}</span><span>Details</span><span>Status</span><span>Updated</span><span /></div>{rows.map(row => <div className="sales-row" key={row.id}>{tab === 'customers' && <><div className="record-title"><div className="record-avatar">{(row as SalesCustomer).name.slice(0, 2).toUpperCase()}</div><div><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><strong>{(row as SalesCustomer).name}</strong>{(row as SalesCustomer).customerCode && <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px', fontFamily: 'monospace' }}>{(row as SalesCustomer).customerCode}</span>}</div><span>{(row as SalesCustomer).company || (row as SalesCustomer).email}</span></div></div><span>{(row as SalesCustomer).phone}</span><StatusPill value={(row as SalesCustomer).status} /><span>{(row as SalesCustomer).lastActivity}</span></>}{tab === 'vehicles' && <><div className="record-title"><div className="record-avatar vehicle"><Icon name="car" size={17} /></div><div><strong>{(row as SalesVehicle).name}</strong><span>{(row as SalesVehicle).stockNumber}</span></div></div><strong>{(row as SalesVehicle).price}</strong><StatusPill value={(row as SalesVehicle).status} /><span>{(row as SalesVehicle).age}</span></>}{tab === 'leads' && <><div className="record-title"><div className="record-avatar lead"><Icon name="users" size={17} /></div><div><strong>{(row as SalesLead).name}</strong><span>{(row as SalesLead).interest}</span></div></div><span>{(row as SalesLead).source} · {(row as SalesLead).owner}</span><StatusPill value={(row as SalesLead).status} /><span>{(row as SalesLead).created}</span></>}{tab === 'bookings' && <><div className="record-title"><div className="record-avatar booking"><Icon name="calendar" size={17} /></div><div><strong>{(row as SalesBooking).customer}</strong><span>{(row as SalesBooking).vehicle}</span></div></div><span>{(row as SalesBooking).date} · {(row as SalesBooking).time}</span><StatusPill value={(row as SalesBooking).status} /><span>{(row as SalesBooking).id}</span></>}</div>)}</div>
}

function StatusPill({ value }: { value: string }) { return <span className={`status-pill ${value.toLowerCase().replace(/\s/g, '-')}`}>{value}</span> }

function AddVehicleModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: (notice: string) => void }) {
  const [make, setMake] = useState('Toyota')
  const [model, setModel] = useState('')
  const [modelYear, setModelYear] = useState<number>(new Date().getFullYear())
  const [registrationNo, setRegistrationNo] = useState(`STK-${Math.floor(1000 + Math.random() * 9000)}`)
  const [vin, setVin] = useState('')
  const [color, setColor] = useState('White')
  const [price, setPrice] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token || !make.trim() || !model.trim() || !registrationNo.trim()) {
      return setError('Please provide Make, Model, and Stock / Registration number.')
    }
    setBusy(true)
    setError('')
    try {
      const parsedPrice = price.trim() ? Number(price.replace(/[^0-9.]/g, '')) : undefined
      await createVehicle(token, {
        make: make.trim(),
        model: model.trim(),
        modelYear: modelYear ? Number(modelYear) : undefined,
        registrationNo: registrationNo.trim(),
        vin: vin.trim() || undefined,
        color: color.trim() || undefined,
        price: parsedPrice && !isNaN(parsedPrice) ? parsedPrice : undefined,
      })
      onDone(`Vehicle ${modelYear || ''} ${make} ${model} (${registrationNo}) added to stock for sale!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add vehicle to stock.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={event => event.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">VEHICLE INVENTORY</p>
            <h2>Add vehicle to stock</h2>
            <p>Add a new car into stock for sale with make, model, specifications, and asking price.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>
              Make / Brand *
              <input
                required
                list="car-makes"
                value={make}
                onChange={e => setMake(e.target.value)}
                placeholder="e.g. Toyota, Honda, Ford"
              />
              <datalist id="car-makes">
                <option value="Toyota" />
                <option value="Honda" />
                <option value="Ford" />
                <option value="Hyundai" />
                <option value="Kia" />
                <option value="BMW" />
                <option value="Mercedes-Benz" />
                <option value="Audi" />
                <option value="Nissan" />
                <option value="Suzuki" />
                <option value="Volkswagen" />
              </datalist>
            </label>
            <label>
              Model *
              <input
                required
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="e.g. Corolla, Civic, Ranger"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Model Year
              <input
                type="number"
                min="1900"
                max={new Date().getFullYear() + 2}
                value={modelYear}
                onChange={e => setModelYear(Number(e.target.value))}
              />
            </label>
            <label>
              Color
              <input
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="e.g. White, Black, Silver"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Stock / Reg. No. *
              <input
                required
                value={registrationNo}
                onChange={e => setRegistrationNo(e.target.value)}
                placeholder="e.g. STK-1001 or plate"
              />
            </label>
            <label>
              VIN / Chassis No. <span className="optional">optional</span>
              <input
                value={vin}
                onChange={e => setVin(e.target.value)}
                placeholder="17-character VIN"
              />
            </label>
          </div>

          <label>
            Asking / Sale Price (Rs.) <span className="optional">optional</span>
            <input
              type="text"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="e.g. 45,000"
            />
          </label>

          {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Adding to stock…' : 'Add to stock'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function AddCustomerModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: (notice: string) => void }) {
  const [name, setName] = useState('')
  const [customerCode, setCustomerCode] = useState(() => 'CUST-' + Math.floor(1000 + Math.random() * 9000))
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token || !name.trim() || !phone.trim()) return setError('Please enter customer name and phone number.')
    setBusy(true)
    setError('')
    try {
      const created = await createCustomer(token, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        sourceId: customerCode.trim().toUpperCase(),
        sourceType: 'CUSTOMER_CODE'
      })
      const finalCode = (created as any)?.sourceId || customerCode
      onDone(`Customer ${name} (${finalCode}) registered successfully with unique ID!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create customer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={event => event.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">CUSTOMER DIRECTORY</p>
            <h2>New customer</h2>
            <p>Register a new retail or fleet client with automatic unique ID.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <label style={{ flex: '1.25' }}>
              Full name *
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" />
            </label>
            <label style={{ flex: '0.75' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Customer ID</span>
                <span style={{ color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', fontWeight: 700 }}>
                  Unique
                </span>
              </div>
              <input
                required
                value={customerCode}
                onChange={e => setCustomerCode(e.target.value.toUpperCase())}
                placeholder="CUST-XXXX"
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: '#0369a1',
                  background: '#f0f9ff',
                  borderColor: '#bae6fd'
                }}
              />
            </label>
          </div>
          <div className="form-row">
            <label>Phone *<input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +61 400 123 456" /></label>
            <label>Email <span className="optional">optional</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" /></label>
          </div>
          <label>Address <span className="optional">optional</span><input value={address} onChange={e => setAddress(e.target.value)} placeholder="City / Street address" /></label>
          {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create customer'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function AddLeadModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: (notice: string) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [interest, setInterest] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token || !name.trim() || !phone.trim()) return setError('Please enter prospect name and phone.')
    setBusy(true)
    setError('')
    try {
      await createLead(token, { name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, interest: interest.trim() || 'Vehicle enquiry', status: 'NEW' })
      onDone(`Sales lead for ${name} registered!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create lead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={event => event.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">SALES PIPELINE</p>
            <h2>New sales lead</h2>
            <p>Capture a prospect vehicle inquiry or showroom walk-in.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label>Prospect name *<input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Smith" /></label>
          <div className="form-row">
            <label>Phone *<input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +61 400 987 654" /></label>
            <label>Email <span className="optional">optional</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@example.com" /></label>
          </div>
          <label>Vehicle of interest<input value={interest} onChange={e => setInterest(e.target.value)} placeholder="e.g. 2024 Toyota Corolla Ascent" /></label>
          {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create lead'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function BookingModal({ token, vehicles = [], customers = [], onClose, onDone }: { token: string | null; vehicles?: SalesVehicle[]; customers?: SalesCustomer[]; onClose: () => void; onDone: () => void }) {
  const [customerId, setCustomerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!token || !date || !time) return
    if (!customerId) return setError('Select a registered customer before creating a booking.')
    setBusy(true)
    try {
      const selectedCustomerObj = customers.find(c => c.id === customerId)
       const selectedVehicleObj = vehicles.find(v => v.id === vehicleId)
       const vehicleAmount = selectedVehicleObj?.price ? Number(String(selectedVehicleObj.price).replace(/[^0-9.]/g, '')) : undefined
       await createBooking(token, {
         bookingDate: `${date}T${time}:00`,
         status: 'RESERVED',
         customerId,
         vehicleId: vehicleId || undefined,
         totalAmount: vehicleAmount && !isNaN(vehicleAmount) ? vehicleAmount : undefined,
         notes: selectedCustomerObj ? `Customer: ${selectedCustomerObj.name}` : undefined,
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create booking.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">SALES WORKSPACE</p>
            <h2>New vehicle order / booking</h2>
            <p>Reserve vehicle allocation and showroom appointment with a customer.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label>
             Customer *
             <select required value={customerId} onChange={e => {
               setCustomerId(e.target.value)
             }}>
               <option value="">Select registered customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.customerCode ? `(${c.customerCode})` : ''} — {c.phone}
                </option>
              ))}
            </select>
           </label>
          <label>
            Vehicle
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
              <option value="">Select a vehicle from stock (optional)</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.stockNumber}) — {v.price} [{v.status}]
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>Date<input required type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>Time<input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create order / booking'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

const demoParts: Part[] = []
const demoStock: StockBalance[] = []
export const isLowStock = (item: Pick<StockBalance, 'quantity' | 'part'>) => item.quantity <= (item.part?.reorderLevel ?? 0)
const demoSuppliers: Supplier[] = []
type PartsTab = 'catalog' | 'stock' | 'suppliers' | 'movements' | 'purchase-orders' | 'low-stock'
type MovementAction = 'receive' | 'issue' | 'return' | 'transfer' | 'adjust'

export function PartsWorkspace({ token }: { token: string | null }) {
  const [tab, setTab] = useState<PartsTab>('stock')
  const [parts, setParts] = useState(demoParts), [stock, setStock] = useState(demoStock), [suppliers, setSuppliers] = useState(demoSuppliers), [movements, setMovements] = useState<StockMovementRecord[]>([]), [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]), [lowStockAlerts, setLowStockAlerts] = useState<StockBalance[]>([])
  const [query, setQuery] = useState(''), [stockFilter, setStockFilter] = useState('all'), [loading, setLoading] = useState(true), [fallback, setFallback] = useState(false), [refresh, setRefresh] = useState(0)
  const [action, setAction] = useState<MovementAction | null>(null), [notice, setNotice] = useState('')
  const [showAddPart, setShowAddPart] = useState(false), [showPurchaseOrder, setShowPurchaseOrder] = useState(false)
  const [initialActionPart, setInitialActionPart] = useState<string | undefined>(undefined)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token) { setLoading(false); setFallback(true); return () => { mounted = false } }
    Promise.all([getParts(token), getStock(token), getSuppliers(token), getMovements(token), getPurchaseOrders(token), getLowStockAlerts(token)]).then(([nextParts, nextStock, nextSuppliers, nextMovements, nextOrders, nextLowStock]) => {
      if (!mounted) return
      setParts(nextParts)
      setStock(nextStock.map(item => ({ ...item, part: item.part ?? nextParts.find(part => part.code === item.itemCode) })))
      setSuppliers(nextSuppliers)
      if (Array.isArray(nextMovements)) setMovements(nextMovements)
      if (Array.isArray(nextOrders)) setPurchaseOrders(nextOrders)
      if (Array.isArray(nextLowStock)) setLowStockAlerts(nextLowStock)
      setFallback(false)
    }).catch(() => { if (mounted) setFallback(true) }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [token, refresh])

  const baseRows = tab === 'catalog' ? parts : tab === 'stock' ? stock : tab === 'suppliers' ? suppliers : tab === 'low-stock' ? lowStockAlerts : purchaseOrders
  const rows = baseRows.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())).filter(row => tab !== 'stock' || stockFilter === 'all' || (row as StockBalance).quantity <= ((row as StockBalance).part?.reorderLevel ?? 0))
  const lowStock = stock.filter(isLowStock).length
  const totalUnits = stock.reduce((sum, item) => sum + item.quantity, 0)
  const labels: Record<PartsTab, string> = { catalog: 'Parts catalog', stock: 'Stock overview', suppliers: 'Suppliers', movements: 'Stock movements', 'purchase-orders': 'Purchase orders', 'low-stock': 'Low-stock alerts' }

  return <>
    <section className="page-intro sales-intro">
      <div>
        <p className="eyebrow">SPARE PARTS / INVENTORY <span className="live-pill"><i /> LIVE</span></p>
        <h1>Parts control centre</h1>
        <p className="subtitle">Keep every workshop job supplied, counted and traceable.</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="secondary-button" onClick={() => setShowAddPart(true)}>＋ New part</button>
         <button className="primary-button" onClick={() => { setInitialActionPart(undefined); setAction('receive'); }}><Icon name="plus" size={17} /> Receive stock</button>
         <button className="secondary-button" onClick={() => setShowPurchaseOrder(true)}>＋ New purchase order</button>
      </div>
    </section>

    <div className="parts-summary">
      <div>
        <strong>Inventory health</strong>
        <span>{fallback ? 'Demo data · API unavailable' : 'Connected to live inventory data'}</span>
      </div>
      <div className="parts-summary-stats">
        <span><b>{parts.length}</b> active parts</span>
        <span><b>{totalUnits}</b> units on hand</span>
        <span className={lowStock ? 'warning-stat' : ''}><b>{lowStock}</b> low stock</span>
      </div>
    </div>

    {fallback && <div className="demo-banner"><Icon name="alert" size={16} /><span><strong>Demo fallback active.</strong> Showing sample inventory records while the parts API is unavailable.</span><button onClick={() => setRefresh(value => value + 1)}><Icon name="refresh" size={14} /> Retry connection</button></div>}
    {notice && <div className="success-banner"><Icon name="check" size={16} /> {notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="x" size={14} /></button></div>}

    <section className="parts-panel panel">
      <div className="sales-tabs">
        {(Object.keys(labels) as PartsTab[]).map(item => (
          <button className={tab === item ? 'active' : ''} onClick={() => { setTab(item); setQuery(''); setStockFilter('all') }} key={item}>
            {labels[item]} <span>{item === 'catalog' ? parts.length : item === 'stock' ? stock.length : item === 'suppliers' ? suppliers.length : item === 'movements' ? movements.length : item === 'low-stock' ? lowStockAlerts.length : purchaseOrders.length}</span>
          </button>
        ))}
      </div>

      <div className="sales-toolbar">
        <label className="sales-search">
          <Icon name="search" size={16} />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${labels[tab].toLowerCase()}…`} />
        </label>
        {tab === 'stock' && (
          <label className="status-filter">
            <Icon name="filter" size={15} />
            <select value={stockFilter} onChange={event => setStockFilter(event.target.value)}>
              <option value="all">All stock levels</option>
              <option value="low">Low stock only</option>
            </select>
          </label>
        )}
        <div className="movement-actions">
          {tab === 'catalog' && (
            <button className="movement-button receive" onClick={() => setShowAddPart(true)}>＋ Add part</button>
          )}
           <button className="movement-button receive" onClick={() => { setInitialActionPart(undefined); setAction('receive'); }}>Receive</button>
           <button className="movement-button issue" onClick={() => setAction('issue')}>Issue</button>
           <button className="movement-button return" onClick={() => setAction('return')}>Return</button>
           <button className="movement-button reserved" onClick={() => setAction('transfer')}>Transfer</button>
           <button className="movement-button pending" onClick={() => setAction('adjust')}>Adjust</button>
        </div>
      </div>

      {loading ? (
        <div className="sales-state"><span className="spinner" /><strong>Loading parts workspace…</strong><span>Connecting to your inventory records.</span></div>
       ) : tab === 'movements' ? (
         <MovementList rows={movements.filter(m => JSON.stringify(m).toLowerCase().includes(query.toLowerCase()))} />
       ) : tab === 'purchase-orders' ? (
         <PurchaseOrderRows rows={rows as PurchaseOrder[]} token={token} onDone={(message) => { setNotice(message); setRefresh(value => value + 1) }} />
       ) : tab === 'low-stock' ? (
         <StockRows rows={rows as StockBalance[]} onAction={setAction} />
      ) : rows.length === 0 ? (
        <div className="sales-state">
          <Icon name="box" size={23} />
          <strong>No {labels[tab].toLowerCase()} found</strong>
          <span>{tab === 'catalog' ? 'Add custom spare parts to start tracking your inventory catalog.' : 'Try a different search or clear the filter.'}</span>
          {tab === 'catalog' ? (
            <button className="primary-button" style={{ marginTop: '12px' }} onClick={() => setShowAddPart(true)}>＋ Add custom part</button>
          ) : (
            <button className="text-button" onClick={() => setQuery('')}>Clear search</button>
          )}
        </div>
      ) : tab === 'catalog' ? (
        <PartsRows rows={rows as Part[]} />
      ) : tab === 'stock' ? (
        <StockRows rows={rows as StockBalance[]} onAction={setAction} />
      ) : (
        <SupplierRows rows={rows as Supplier[]} />
      )}
    </section>

    {action && (
      <StockActionModal
        action={action}
        parts={parts}
        initialItemCode={initialActionPart}
        token={token}
        onClose={() => setAction(null)}
        onDone={(message) => { setAction(null); setNotice(message); setRefresh(value => value + 1) }}
        onOpenAddPart={() => setShowAddPart(true)}
      />
    )}

    {showAddPart && (
      <AddPartModal
        token={token}
        onClose={() => setShowAddPart(false)}
        onDone={(message, createdCode) => {
          setNotice(message)
          setRefresh(value => value + 1)
          if (createdCode && action) {
            setInitialActionPart(createdCode)
          }
        }}
      />
    )}
    {showPurchaseOrder && <PurchaseOrderModal token={token} suppliers={suppliers} parts={parts} onClose={() => setShowPurchaseOrder(false)} onDone={(message) => { setShowPurchaseOrder(false); setNotice(message); setRefresh(value => value + 1) }} />}
  </>
}

function PartsRows({ rows }: { rows: Part[] }) { return <div className="inventory-table"><div className="sales-table-head"><span>Part</span><span>Code</span><span>Unit</span><span>Reorder point</span></div>{rows.map(part => <div className="sales-row" key={part.id}><div className="record-title"><div className="record-avatar vehicle"><Icon name="wrench" size={16} /></div><div><strong>{part.name}</strong><span>{part.description || 'Genuine replacement part'}</span></div></div><code>{part.code}</code><span>{part.unit}</span><span>{part.reorderLevel} units</span></div>)}</div> }
function StockRows({ rows, onAction }: { rows: StockBalance[]; onAction: (action: MovementAction) => void }) { return <div className="inventory-table"><div className="sales-table-head"><span>Part</span><span>Location</span><span>On hand</span><span>Health</span></div>{rows.map(item => { const low = isLowStock(item); return <div className={`sales-row ${low ? 'low-stock-row' : ''}`} key={item.id}><div className="record-title"><div className={`record-avatar ${low ? 'low-avatar' : 'vehicle'}`}><Icon name={low ? 'alert' : 'box'} size={16} /></div><div><strong>{item.part?.name || item.itemCode}</strong><span>{item.itemCode}</span></div></div><span>{item.locationId}</span><strong className="quantity-value">{item.quantity} <small>{item.part?.unit || 'EA'}</small></strong><span className={`stock-health ${low ? 'low' : 'healthy'}`}>{low ? 'Reorder now' : 'Healthy'}</span><button className="row-action" onClick={() => onAction('issue')}>Issue</button></div>})}</div> }
function SupplierRows({ rows }: { rows: Supplier[] }) { return <div className="inventory-table"><div className="sales-table-head"><span>Supplier</span><span>Code</span><span>Contact</span><span>Status</span></div>{rows.map(supplier => <div className="sales-row" key={supplier.id}><div className="record-title"><div className="record-avatar lead"><Icon name="users" size={16} /></div><div><strong>{supplier.name}</strong><span>{supplier.address || 'Approved parts supplier'}</span></div></div><code>{supplier.code}</code><span>{supplier.email || supplier.phone || 'No contact details'}</span><StatusPill value="Active" /></div>)}</div> }
function PurchaseOrderRows({ rows, token, onDone }: { rows: PurchaseOrder[]; token: string | null; onDone: (message: string) => void }) { return <div className="inventory-table"><div className="sales-table-head"><span>Order</span><span>Supplier</span><span>Status</span><span>Lines</span><span>Action</span></div>{rows.map(order => <div className="sales-row" key={order.id}><div className="record-title"><div className="record-avatar lead"><Icon name="clipboard" size={16} /></div><div><strong>{order.orderNo}</strong><span>{new Date(order.orderedAt).toLocaleDateString()}</span></div></div><span>{order.supplier?.name || order.supplierId}</span><StatusPill value={order.status} /><span>{order.lines?.length || 0} parts</span><button className="row-action" disabled={!token || order.status === 'RECEIVED'} onClick={async () => { if (!token) return; try { await receivePurchaseOrder(token, order.id, 'MAIN'); onDone(`Purchase order ${order.orderNo} received into MAIN.`) } catch (error) { onDone(error instanceof Error ? error.message : 'Unable to receive purchase order.') } }}>Receive</button></div>)}</div> }

function PurchaseOrderModal({ token, suppliers, parts, onClose, onDone }: { token: string | null; suppliers: Supplier[]; parts: Part[]; onClose: () => void; onDone: (message: string) => void }) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [partCode, setPartCode] = useState(parts[0]?.code || '')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); if (!token || !supplierId || !partCode || Number(quantity) <= 0 || Number(unitCost) <= 0) return setError('Select a supplier and part and enter positive quantity and unit cost.'); setBusy(true); setError(''); try { await createPurchaseOrder(token, { supplierId, notes: notes || undefined, lines: [{ partCode, quantity: Number(quantity), unitCost: Number(unitCost) }] }); onDone('Purchase order created successfully.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create purchase order.') } finally { setBusy(false) } }
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="booking-modal" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">PROCUREMENT</p><h2>New purchase order</h2><p>Create a supplier order for parts receiving and Accounts Payable posting.</p></div><button className="modal-close" onClick={onClose}>×</button></div><form onSubmit={submit}><label>Supplier<select required value={supplierId} onChange={e => setSupplierId(e.target.value)}>{suppliers.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></label><label>Part<select required value={partCode} onChange={e => setPartCode(e.target.value)}>{parts.map(p => <option key={p.id} value={p.code}>{p.code} · {p.name}</option>)}</select></label><div className="form-row"><label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><label>Unit cost<input type="number" min="0.01" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></label></div><label>Notes<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Supplier or delivery notes" /></label>{error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Create purchase order'}</button></div></form></section></div>
}
function MovementList({ rows }: { rows: StockMovementRecord[] }) {
  if (rows.length === 0) {
    return (
      <div className="sales-state" style={{ padding: '32px 0' }}>
        <Icon name="box" size={23} />
        <strong>No stock movements recorded</strong>
        <span>Stock movements will appear here when parts are received, issued, returned or transferred.</span>
      </div>
    )
  }
  return (
    <div className="inventory-table">
      <div className="sales-table-head">
        <span>Part / Item</span>
        <span>Movement Type</span>
        <span>Quantity</span>
        <span>Location</span>
        <span>Date & Reference</span>
      </div>
      {rows.map((m) => {
        const qtyNum = Number(m.quantity)
        const isPositive = qtyNum > 0 && m.type !== 'ISSUE'
        const pillTone = m.type === 'RECEIPT' ? 'active' : m.type === 'ISSUE' ? 'sold' : m.type === 'TRANSFER' ? 'reserved' : 'pending'
        return (
          <div className="sales-row" key={m.id}>
            <div className="record-title">
              <div className="record-avatar vehicle">
                <Icon name="box" size={16} />
              </div>
              <div>
                <strong>{m.part?.name || m.itemCode}</strong>
                <span>{m.itemCode}</span>
              </div>
            </div>
            <span>
              <span className={`status-pill ${pillTone}`}>{m.type}</span>
            </span>
            <strong className="quantity-value" style={{ color: isPositive ? '#16a34a' : '#dc2626' }}>
              {isPositive ? `+${qtyNum}` : `${qtyNum}`} <small>{m.part?.unit || 'EA'}</small>
            </strong>
            <span>{m.location?.name || m.location?.code || 'Main store'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
              <span>{new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {m.reference && <small style={{ color: '#64748b' }}>{m.reference}</small>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StockActionModal({ action, parts, initialItemCode, token, onClose, onDone, onOpenAddPart }: {
  action: MovementAction;
  parts: Part[];
  initialItemCode?: string;
  token: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
  onOpenAddPart?: () => void;
}) {
  const [form, setForm] = useState<StockCommand>({
    locationId: 'MAIN',
    itemCode: initialItemCode || parts[0]?.code || '',
    quantity: 1,
    reference: ''
  })
  const [fromLocation, setFromLocation] = useState('MAIN')
  const [toLocation, setToLocation] = useState('WORKSHOP')
  const [newQuantity, setNewQuantity] = useState('0')
  const [error, setError] = useState(''), [submitting, setSubmitting] = useState(false)
  const title = action === 'receive' ? 'Receive stock' : action === 'issue' ? 'Issue stock' : action === 'return' ? 'Return stock' : action === 'transfer' ? 'Transfer stock' : 'Adjust stock'

  useEffect(() => {
    if (initialItemCode) {
      setForm(f => ({ ...f, itemCode: initialItemCode }))
    }
  }, [initialItemCode])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.itemCode) return setError('Choose a part.')
    if (action !== 'adjust' && form.quantity <= 0) return setError('Quantity must be greater than zero.')
    setSubmitting(true)
    setError('')
    try {
      if (token) {
        if (action === 'transfer') await transferStock(token, { fromLocationId: fromLocation, toLocationId: toLocation, itemCode: form.itemCode, quantity: form.quantity, reference: form.reference })
        else if (action === 'adjust') await adjustStock(token, { locationId: form.locationId, itemCode: form.itemCode, newQuantity: Number(newQuantity), reason: form.reference })
        else { const call = action === 'receive' ? receiveStock : action === 'issue' ? issueStock : returnStock; await call(token, form) }
      }
      onDone(`${title} recorded for ${form.itemCode}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this stock movement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">INVENTORY MOVEMENT</p>
            <h2>{title}</h2>
            <p>Every movement is recorded against a location and part.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span>Part</span>
              {onOpenAddPart && (
                <button
                  type="button"
                  className="text-button"
                  style={{ fontSize: '12px', padding: '0 4px', fontWeight: 600, color: '#3b81dd', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={onOpenAddPart}
                >
                  ＋ Add custom part
                </button>
              )}
            </div>
            <select value={form.itemCode} onChange={event => setForm({ ...form, itemCode: event.target.value })}>
              <option value="" disabled>Select a part</option>
              {parts.map(part => <option key={part.id} value={part.code}>{part.code} · {part.name}</option>)}
            </select>
          </label>
          <div className="form-row">
             {action === 'transfer' ? <><label>From location<input required value={fromLocation} onChange={event => setFromLocation(event.target.value)} placeholder="MAIN" /></label><label>To location<input required value={toLocation} onChange={event => setToLocation(event.target.value)} placeholder="WORKSHOP" /></label></> : <label>Location<input required value={form.locationId} onChange={event => setForm({ ...form, locationId: event.target.value })} placeholder="MAIN" /></label>}
             {action === 'adjust' ? <label>New quantity<input required min="0" type="number" value={newQuantity} onChange={event => setNewQuantity(event.target.value)} /></label> : <label>Quantity<input required min="1" type="number" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></label>}
          </div>
          <label>Reference <span className="optional">optional</span><input value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} placeholder="PO, work order or note" /></label>
          {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting && <span className="spinner spinner-light" />}
              {submitting ? 'Saving…' : `Record ${action}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function AddPartModal({ token, onClose, onDone }: {
  token: string | null;
  onClose: () => void;
  onDone: (message: string, createdCode?: string) => void;
}) {
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single')
`r`n  // Single mode state
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('EA')
  const [reorderLevel, setReorderLevel] = useState('5')
  const [receiveStockNow, setReceiveStockNow] = useState(false)
  const [locationId, setLocationId] = useState('MAIN')
  const [quantity, setQuantity] = useState('10')
  const [stockReference, setStockReference] = useState('Opening stock')

  // Batch mode state: multiple parts
  const [batchRows, setBatchRows] = useState<Array<{ code: string; name: string; unit: string; reorderLevel: string }>>([
    { code: '', name: '', unit: 'EA', reorderLevel: '5' },
    { code: '', name: '', unit: 'EA', reorderLevel: '5' },
    { code: '', name: '', unit: 'EA', reorderLevel: '5' },
  ])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const quickUnits = ['EA', 'SET', 'LTR', 'PAIR', 'BOX', 'KG', 'MTR']

  function addBatchRow() {
    setBatchRows(rows => [...rows, { code: '', name: '', unit: 'EA', reorderLevel: '5' }])
  }

  function removeBatchRow(index: number) {
    setBatchRows(rows => rows.length > 1 ? rows.filter((_, i) => i !== index) : rows)
  }

  function updateBatchRow(index: number, field: string, val: string) {
    setBatchRows(rows => rows.map((r, i) => i === index ? { ...r, [field]: val } : r))
  }

  async function handleSingleSubmit(addAnother: boolean = false) {
    if (!token) return setError('You must be signed in.')
    if (!code.trim() || !name.trim()) return setError('Part code and part name are required.')
`r`n    setSubmitting(true)
    setError('')
    try {
      const partPayload: CreatePartInput = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        unit: unit.trim().toUpperCase() || 'EA',
        reorderLevel: Number(reorderLevel) || 0
      }
      const created = await createPart(token, partPayload)

      if (receiveStockNow) {
        const qty = Number(quantity)
        if (qty > 0) {
          await receiveStock(token, {
            locationId: locationId.trim() || 'MAIN',
            itemCode: created.code,
            quantity: qty,
            reference: stockReference.trim() || 'Opening inventory'
          })
        }
      }

      if (addAnother) {
        setCode('')
        setName('')
        setDescription('')
        setError('')
        setSubmitting(false)
        onDone(`Part ${created.code} added. Ready to enter next part.`, created.code)
      } else {
        onDone(`Part ${created.code} added to catalog successfully.`, created.code)
        onClose()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create part.')
      setSubmitting(false)
    }
  }

  async function handleBatchSubmit() {
    if (!token) return setError('You must be signed in.')
    const validRows = batchRows.filter(r => r.code.trim() && r.name.trim())
    if (validRows.length === 0) return setError('Please enter at least one valid part with a code and name.')

    setSubmitting(true)
    setError('')
    try {
      const payload: CreatePartInput[] = validRows.map(r => ({
        code: r.code.trim().toUpperCase(),
        name: r.name.trim(),
        unit: r.unit.trim().toUpperCase() || 'EA',
        reorderLevel: Number(r.reorderLevel) || 0
      }))

      const created = await createPartsBatch(token, payload)
      onDone(`Successfully added ${created.length} custom parts to the catalog.`, created[0]?.code)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create parts batch.')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="booking-modal"
        style={{ width: entryMode === 'batch' ? 'min(100%, 720px)' : 'min(100%, 520px)', maxHeight: '90vh', overflowY: 'auto' }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">PARTS INVENTORY</p>
            <h2>Add spare parts</h2>
            <p>Register custom parts in the catalog or add multiple items in bulk.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="sales-tabs" style={{ marginBottom: '16px' }}>
          <button className={entryMode === 'single' ? 'active' : ''} onClick={() => { setEntryMode('single'); setError('') }}>
            Single custom part
          </button>
          <button className={entryMode === 'batch' ? 'active' : ''} onClick={() => { setEntryMode('batch'); setError('') }}>
            Batch entry (Multiple parts)
          </button>
        </div>

        {entryMode === 'single' ? (
          <form onSubmit={e => { e.preventDefault(); handleSingleSubmit(false) }}>
            <div className="form-row">
              <label>
                Part Code <small>(e.g. SPK-001)</small>
                <input
                  required
                  placeholder="e.g. SPK-PLUG-001"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                />
              </label>
              <label>
                Unit of Measure
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  {quickUnits.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            </div>

            <label>
              Part Name
              <input
                required
                placeholder="e.g. NGK Laser Iridium Spark Plug"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>

            <label>
              Description / Category <span className="optional">optional</span>
              <input
                placeholder="e.g. Genuine replacement ignition components"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </label>

            <label>
              Reorder Point <small>(Low stock warning threshold)</small>
              <input
                type="number"
                min="0"
                value={reorderLevel}
                onChange={e => setReorderLevel(e.target.value)}
              />
            </label>

            <div style={{ marginTop: '14px', marginBottom: '14px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: receiveStockNow ? '12px' : '0' }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto', margin: 0 }}
                  checked={receiveStockNow}
                  onChange={e => setReceiveStockNow(e.target.checked)}
                />
                <span>Receive opening stock immediately for this part</span>
              </label>

              {receiveStockNow && (
                <div style={{ marginTop: '10px' }}>
                  <div className="form-row">
                    <label>
                      Storage Location
                      <input
                        required
                        value={locationId}
                        onChange={e => setLocationId(e.target.value)}
                        placeholder="MAIN"
                      />
                    </label>
                    <label>
                      Quantity to Receive
                      <input
                        required
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                      />
                    </label>
                  </div>
                  <label>
                    Reference / PO Note
                    <input
                      value={stockReference}
                      onChange={e => setStockReference(e.target.value)}
                      placeholder="Opening stock reference"
                    />
                  </label>
                </div>
              )}
            </div>

            {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button type="button" className="secondary-button" disabled={submitting} onClick={() => handleSingleSubmit(true)}>
                Save &amp; add another
              </button>
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting && <span className="spinner spinner-light" />}
                {submitting ? 'Saving…' : 'Save part'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '14px' }}>
              Add multiple custom parts in one step. Leave unused rows blank or delete them.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 0.8fr 0.8fr 32px', gap: '8px', fontSize: '11px', fontWeight: 700, color: '#64748b', paddingBottom: '4px', borderBottom: '1px solid #edf0f3' }}>
                <span>Part Code *</span>
                <span>Part Name *</span>
                <span>Unit</span>
                <span>Reorder Point</span>
                <span></span>
              </div>

              {batchRows.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 0.8fr 0.8fr 32px', gap: '8px', alignItems: 'center' }}>
                  <input
                    placeholder="e.g. BRK-002"
                    value={row.code}
                    onChange={e => updateBatchRow(idx, 'code', e.target.value.toUpperCase())}
                    style={{ marginTop: 0, padding: '8px' }}
                  />
                  <input
                    placeholder="e.g. Ceramic Brake Rotor"
                    value={row.name}
                    onChange={e => updateBatchRow(idx, 'name', e.target.value)}
                    style={{ marginTop: 0, padding: '8px' }}
                  />
                  <select
                    value={row.unit}
                    onChange={e => updateBatchRow(idx, 'unit', e.target.value)}
                    style={{ marginTop: 0, padding: '8px' }}
                  >
                    {quickUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={row.reorderLevel}
                    onChange={e => updateBatchRow(idx, 'reorderLevel', e.target.value)}
                    style={{ marginTop: 0, padding: '8px' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeBatchRow(idx)}
                    title="Remove row"
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', height: '34px', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={addBatchRow}
              style={{ width: '100%', marginBottom: '16px', borderStyle: 'dashed' }}
            >
              ＋ Add another row
            </button>

            {error && <p className="form-error"><Icon name="alert" size={14} /> {error}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button type="button" className="primary-button" disabled={submitting} onClick={handleBatchSubmit}>
                {submitting && <span className="spinner spinner-light" />}
                {submitting ? 'Saving parts…' : `Save ${batchRows.filter(r => r.code.trim() && r.name.trim()).length || ''} parts`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

const demoJobs: ServiceJobCard[] = []
const serviceStatuses: Array<'All' | ServiceStatus> = ['All', 'OPEN', 'ESTIMATED', 'APPROVED', 'IN_PROGRESS', 'WAITING_PARTS', 'QUALITY_CHECK', 'READY_FOR_INVOICE', 'CLOSED']
const statusLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/(^| )\w/g, s => s.toUpperCase())

export function ServiceWorkspace({ token }: { token: string | null }) {
  const [jobs, setJobs] = useState(demoJobs), [selectedId, setSelectedId] = useState(demoJobs[0]?.id || '')
  const [status, setStatus] = useState<'All' | ServiceStatus>('All'), [query, setQuery] = useState(''), [loading, setLoading] = useState(true), [fallback, setFallback] = useState(false), [refresh, setRefresh] = useState(0), [notice, setNotice] = useState('')
   const [surface, setSurface] = useState<'estimate' | 'parts' | 'labor' | 'inspection' | null>(null), [newJob, setNewJob] = useState(false), [serviceReport, setServiceReport] = useState<any>(null)
  useEffect(() => { let mounted = true; setLoading(true); if (!token) { setLoading(false); setFallback(true); return () => { mounted = false } }; getJobCards(token).then(rows => { if (mounted) { setJobs(rows); setFallback(false) } }).catch(() => { if (mounted) { setJobs([]); setFallback(true) } }).finally(() => mounted && setLoading(false)); return () => { mounted = false } }, [token, refresh])
  const filtered = useMemo(() => jobs.filter(job => (status === 'All' || job.status === status) && JSON.stringify(job).toLowerCase().includes(query.toLowerCase())), [jobs, status, query])
  const selected = jobs.find(job => job.id === selectedId) ?? filtered[0]
  async function run(action: () => Promise<unknown>, message: string) { try { if (token) await action(); setNotice(message); setSurface(null); setRefresh(v => v + 1) } catch (error) { setNotice(error instanceof Error ? error.message : 'Action could not be completed.') } }
  const openJobsCount = jobs.filter(j => !['CLOSED', 'INVOICED', 'CANCELLED'].includes(j.status)).length
  const activeTechs = Array.from(new Set(jobs.filter(j => !['CLOSED', 'INVOICED', 'CANCELLED'].includes(j.status) && j.assignments?.[0]?.technician?.username).map(j => j.assignments![0].technician!.username)))
  const occupiedBays = Math.min(8, openJobsCount)
  const capacityPct = Math.min(100, Math.round((occupiedBays / 8) * 100))

  return <>
     <section className="page-intro service-intro"><div><p className="eyebrow">WORKSHOP / SERVICE <span className="live-pill"><i /> LIVE</span></p><h1>Mechanical service</h1><p className="subtitle">Keep bays moving, technicians aligned and every job invoice-ready.</p></div><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><button className="secondary-button" disabled={!selected || !token} onClick={() => selected && token && run(() => recordServiceCheckEvent(token, selected.id, { type: 'CHECK_IN', odometer: selected.odometer }), `Vehicle checked in for ${selected.jobNo}.`)}>Check in</button><button className="secondary-button" disabled={!selected || !token} onClick={() => selected && token && run(() => recordServiceCheckEvent(token, selected.id, { type: 'CHECK_OUT', odometer: selected.odometer, notes: 'Customer delivery' }), `Vehicle checked out for ${selected.jobNo}.`)}>Check out</button><button className="secondary-button" disabled={!token} onClick={() => token && getServiceWorkloadReport(token).then(setServiceReport).catch(e => setNotice(e.message))}>Service report</button><button className="primary-button" onClick={() => setNewJob(true)}><Icon name="plus" size={17} /> New job card</button></div></section>
    <div className="service-summary"><div><strong>Workshop floor</strong><span>{fallback ? 'Demo data · API unavailable' : 'Connected to live service data'}</span></div><div className="service-stats"><span><b>{openJobsCount}</b> open jobs</span><span><b>{occupiedBays} / 8</b> bays occupied</span><span><b>{activeTechs.length}</b> technicians active</span></div></div>
    {fallback && <div className="demo-banner"><Icon name="alert" size={16} /><span><strong>Demo fallback active.</strong> Showing representative workshop jobs while the service API is unavailable.</span><button onClick={() => setRefresh(v => v + 1)}><Icon name="refresh" size={14} /> Retry connection</button></div>}
     {notice && <div className="success-banner"><Icon name="check" size={16} /> {notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><Icon name="x" size={14} /></button></div>}
     {serviceReport && <div className="service-summary" style={{ marginBottom: '14px' }}><span><b>{serviceReport.pendingWork}</b> pending work</span><span><b>{money(serviceReport.revenue)}</b> posted revenue</span><span><b>{serviceReport.laborHours}</b> labor hours</span><button className="text-button" onClick={() => setServiceReport(null)}>Dismiss</button></div>}
    <div className="service-context"><div><span className="context-label">SERVICE BAYS</span><strong>{occupiedBays} occupied</strong><small>{occupiedBays === 0 ? 'All bays available' : `${8 - occupiedBays} bays available`}</small></div><div><span className="context-label">TECHNICIANS</span><strong>{activeTechs.length} active</strong><small>{activeTechs.length > 0 ? activeTechs.slice(0, 2).join(', ') + (activeTechs.length > 2 ? ` +${activeTechs.length - 2}` : '') : 'No active assignments'}</small></div><div className="service-progress"><span>Today’s capacity</span><strong>{capacityPct}%</strong><div><i style={{ width: `${capacityPct}%` }} /></div></div></div>
    <section className="service-layout panel"><div className="service-list"><div className="service-toolbar"><label className="sales-search"><Icon name="search" size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs, customers or vehicles…" /></label><select value={status} onChange={e => setStatus(e.target.value as typeof status)}>{serviceStatuses.map(item => <option key={item} value={item}>{item === 'All' ? 'All statuses' : statusLabel(item)}</option>)}</select></div>{loading ? <div className="sales-state"><span className="spinner" /><strong>Loading job cards…</strong><span>Connecting to the workshop service desk.</span></div> : filtered.length === 0 ? <div className="sales-state"><Icon name="wrench" size={23} /><strong>No matching job cards</strong><span>Try a different status or search term.</span><button className="text-button" onClick={() => { setQuery(''); setStatus('All') }}>Clear filters</button></div> : <div className="job-table"><div className="job-head"><span>Job card</span><span>Vehicle / customer</span><span>Technician</span><span>Status</span></div>{filtered.map(job => <button className={`job-row ${selected?.id === job.id ? 'selected' : ''}`} key={job.id} onClick={() => setSelectedId(job.id)}><div><strong>{job.jobNo}</strong><span>{job.openedAt || 'Recently opened'}</span></div><div><strong>{job.vehicle?.make} {job.vehicle?.model}</strong><span>{job.customer?.name}</span></div><span>{job.assignments?.[0]?.technician?.username || 'Unassigned'}</span><StatusPill value={statusLabel(job.status)} /></button>)}</div>}</div><ServiceDetail job={selected} onSurface={setSurface} onStatus={(next) => selected && run(() => token ? updateJobCardStatus(token, selected.id, next) : Promise.resolve(), `Job ${selected.jobNo} moved to ${statusLabel(next)}.`)} /></section>
    {surface && selected && <CompleteServiceActionPanel kind={surface} job={selected} token={token} onClose={() => setSurface(null)} onRun={run} />}
    {newJob && <NewJobCardModal token={token} onClose={() => setNewJob(false)} onDone={() => { setNewJob(false); setRefresh(v => v + 1) }} />}
  </>
}

function ServiceDetail({ job, onSurface, onStatus }: { job?: ServiceJobCard; onSurface: (surface: 'estimate' | 'parts' | 'labor' | 'inspection') => void; onStatus: (status: ServiceStatus) => void }) { if (!job) return <aside className="service-detail empty-detail"><Icon name="clipboard" size={25} /><strong>Select a job card</strong><span>Choose a workshop job to view its workstream.</span></aside>; const tech = job.assignments?.[0]?.technician?.username; return <aside className="service-detail"><div className="detail-top"><div><p className="eyebrow">JOB CARD</p><h2>{job.jobNo}</h2><span>{job.vehicle?.registrationNo || 'Registration pending'} · opened {job.openedAt || 'today'}</span></div><StatusPill value={statusLabel(job.status)} /></div><div className="vehicle-card"><div className="record-avatar vehicle"><Icon name="car" size={19} /></div><div><strong>{job.vehicle?.modelYear} {job.vehicle?.make} {job.vehicle?.model}</strong><span>{job.customer?.name} · {job.odometer?.toLocaleString() || '—'} km</span></div></div><div className="complaint"><span>Customer concern</span><strong>{job.complaint || 'No complaint recorded'}</strong></div><div className="detail-assignment"><span>Assigned technician</span><strong><i className="bay-dot open" /> {tech || 'Unassigned'}</strong><button onClick={() => onSurface('labor')}>Manage</button></div><div className="workstream"><span className="context-label">JOB WORKSTREAM</span><div className="action-grid"><button onClick={() => onSurface('estimate')}><Icon name="clipboard" size={17} /><strong>Estimate</strong><small>Create or review</small></button><button onClick={() => onSurface('parts')}><Icon name="box" size={17} /><strong>Parts request</strong><small>Reserve workshop stock</small></button><button onClick={() => onSurface('labor')}><Icon name="clock" size={17} /><strong>Record labor</strong><small>Track billable time</small></button><button onClick={() => onSurface('inspection')}><Icon name="check" size={17} /><strong>Inspection</strong><small>Quality checklist</small></button></div></div><label className="status-control">Update job status<select value={job.status} onChange={e => onStatus(e.target.value as ServiceStatus)}>{serviceStatuses.slice(1).map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label></aside> }

function ServiceActionPanel({ kind, job, token, onClose, onRun }: { kind: 'estimate' | 'parts' | 'labor' | 'inspection'; job: ServiceJobCard; token: string | null; onClose: () => void; onRun: (action: () => Promise<unknown>, message: string) => void }) { const [value, setValue] = useState(kind === 'labor' ? 'Brake inspection' : kind === 'inspection' ? 'Passed' : kind === 'estimate' ? 'Standard workshop estimate' : 'Brake pad set'); const title = kind === 'estimate' ? 'Estimate workspace' : kind === 'parts' ? 'Parts request' : kind === 'labor' ? 'Record labor' : 'Quality inspection'; const submit = (e: FormEvent) => { e.preventDefault(); if (kind === 'labor' && token) onRun(() => recordLabor(token, job.id, { description: value, hours: 1, rate: 120 }), `Labor recorded on ${job.jobNo}.`); else if (kind === 'inspection' && token) onRun(() => recordInspection(token, job.id, { checklist: { general: true, brakes: true, lights: true }, passed: value === 'Passed' }), `Inspection recorded on ${job.jobNo}.`); else onRun(() => Promise.resolve(), `${title} surface saved for ${job.jobNo}.`); }; return <div className="modal-backdrop" onMouseDown={onClose}><section className="booking-modal service-action-modal" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{job.jobNo}</p><h2>{title}</h2><p>Capture the next service step without leaving the job card.</p></div><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div><form onSubmit={submit}><label>{kind === 'inspection' ? 'Result' : 'Description'}{kind === 'inspection' ? <select value={value} onChange={e => setValue(e.target.value)}><option>Passed</option><option>Needs attention</option></select> : <input required value={value} onChange={e => setValue(e.target.value)} />}</label>{kind === 'labor' && <div className="form-row"><label>Hours<input type="number" min="0.01" step="0.25" defaultValue="1" /></label><label>Rate<input type="number" min="0" defaultValue="120" /></label></div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button"><Icon name="check" size={15} /> Save to job card</button></div></form></section></div> }

 function CompleteServiceActionPanel({ kind, job, token, onClose, onRun }: { kind: 'estimate' | 'parts' | 'labor' | 'inspection'; job: ServiceJobCard; token: string | null; onClose: () => void; onRun: (action: () => Promise<unknown>, message: string) => void }) { const [description, setDescription] = useState(kind === 'labor' ? 'Brake inspection' : kind === 'estimate' ? 'Standard workshop estimate' : kind === 'parts' ? 'Brake pad set' : ''); const [partId, setPartId] = useState(''); const [locationId, setLocationId] = useState('MAIN'); const [technicianId, setTechnicianId] = useState(''); const [lineType, setLineType] = useState<'LABOR' | 'PART' | 'OTHER'>(kind === 'estimate' ? 'LABOR' : 'PART'); const [quantity, setQuantity] = useState('1'); const [unitPrice, setUnitPrice] = useState(kind === 'labor' ? '120' : '0'); const [hours, setHours] = useState('1'); const [rate, setRate] = useState('120'); const [result, setResult] = useState('Passed'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const title = kind === 'estimate' ? 'Estimate workspace' : kind === 'parts' ? 'Parts request' : kind === 'labor' ? 'Record labor' : 'Quality inspection'; async function submit(e: FormEvent) { e.preventDefault(); if (!token) return setError('Sign in to complete this action.'); if (!description.trim()) return setError('Enter a description.'); setBusy(true); setError(''); try { if (kind === 'estimate') await onRun(() => createEstimate(token, job.id, { lines: [{ description: description.trim(), quantity: Number(quantity), unitPrice: Number(unitPrice), lineType, ...(lineType === 'PART' && partId ? { partId } : {}) }] }), `Estimate created for ${job.jobNo}.`); else if (kind === 'parts') { if (!partId.trim()) throw new Error('Enter the part ID for this request.'); await onRun(() => requestParts(token, job.id, { locationId: locationId.trim(), lines: [{ partId: partId.trim(), quantity: Number(quantity) }] }), `Parts requested for ${job.jobNo}.`) } else if (kind === 'labor') { if (technicianId.trim()) { try { await assignTechnician(token, job.id, { technicianId: technicianId.trim() }) } catch {} }; await onRun(() => recordLabor(token, job.id, { description: description.trim(), hours: Number(hours), rate: Number(rate), ...(technicianId.trim() ? { technicianId: technicianId.trim() } : {}) }), `Labor recorded on ${job.jobNo}.`); } else await onRun(() => recordInspection(token, job.id, { checklist: { general: true, brakes: true, lights: true }, passed: result === 'Passed' }), `Inspection recorded on ${job.jobNo}.`); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action could not be completed.') } finally { setBusy(false) } } return <div className="modal-backdrop" onMouseDown={onClose}><section className="booking-modal service-action-modal" onMouseDown={e => e.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">{job.jobNo}</p><h2>{title}</h2><p>Capture the next service step without leaving the job card.</p></div><button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div><form onSubmit={submit}>{kind === 'inspection' ? <label>Result<select value={result} onChange={e => setResult(e.target.value)}><option>Passed</option><option>Needs attention</option></select></label> : <label>{kind === 'parts' ? 'Request description' : 'Description'}<input required value={description} onChange={e => setDescription(e.target.value)} /></label>}{kind === 'estimate' && <><div className="form-row"><label>Line type<select value={lineType} onChange={e => setLineType(e.target.value as typeof lineType)}><option value="LABOR">Labor</option><option value="PART">Part</option><option value="OTHER">Other</option></select></label><label>Quantity<input required min="0.01" step="0.01" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></label></div><div className="form-row"><label>Unit price<input required min="0" step="0.01" type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} /></label>{lineType === 'PART' && <label>Part ID<input required value={partId} onChange={e => setPartId(e.target.value)} placeholder="Part reference" /></label>}</div></>}{kind === 'parts' && <div className="form-row"><label>Location ID<input required value={locationId} onChange={e => setLocationId(e.target.value)} /></label><label>Part ID<input required value={partId} onChange={e => setPartId(e.target.value)} /></label><label>Quantity<input required min="0.0001" step="0.01" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></label></div>}{kind === 'labor' && <><div className="form-row"><label>Hours<input required min="0.01" step="0.25" type="number" value={hours} onChange={e => setHours(e.target.value)} /></label><label>Rate<input required min="0" step="0.01" type="number" value={rate} onChange={e => setRate(e.target.value)} /></label></div><div className="form-row"><label>Technician (Username or ID)<input value={technicianId} onChange={e => setTechnicianId(e.target.value)} placeholder="e.g. technician" /></label></div></>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Saving…' : `Save ${title.toLowerCase()}`}</button></div></form></section></div> }

function NewJobCardModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone?: string; sourceId?: string; customerCode?: string; branchId: string }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; make?: string; model?: string; registrationNo?: string; modelYear?: number; customerId?: string | null; branchId: string }>>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [packageId, setPackageId] = useState('')
  const [isWarranty, setIsWarranty] = useState(false)
  const [warrantyRef, setWarrantyRef] = useState('')
  const [branchId, setBranchId] = useState('MAIN')
  const [complaint, setComplaint] = useState('')
  const [odometer, setOdometer] = useState('')
  const [manualMode, setManualMode] = useState(false)
  const [manualCustomerId, setManualCustomerId] = useState('')
  const [manualVehicleId, setManualVehicleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    setLoading(true)
    Promise.all([
      getSalesResource<any>(token, 'customers').catch(() => []),
      getSalesResource<any>(token, 'vehicles').catch(() => []),
      getServicePackages(token).catch(() => [])
    ]).then(([custs, vehs, servicePackages]) => {
      if (!active) return
      const validCusts = Array.isArray(custs) ? custs : []
      const validVehs = Array.isArray(vehs) ? vehs : []
      setCustomers(validCusts)
      setVehicles(validVehs)
      setPackages(Array.isArray(servicePackages) ? servicePackages : [])
      if (validCusts.length > 0) {
        const firstCust = validCusts[0]
        setSelectedCustomerId(firstCust.id)
        if (firstCust.branchId) setBranchId(firstCust.branchId)
        const matchingVeh = validVehs.find(v => v.customerId === firstCust.id || !v.customerId)
        if (matchingVeh) setSelectedVehicleId(matchingVeh.id)
      } else if (validVehs.length > 0) {
        setSelectedVehicleId(validVehs[0].id)
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [token])

  const matchingVehicles = useMemo(() => {
    if (!selectedCustomerId) return vehicles
    const owned = vehicles.filter(v => v.customerId === selectedCustomerId)
    const unlinked = vehicles.filter(v => !v.customerId)
    return [...owned, ...unlinked]
  }, [vehicles, selectedCustomerId])

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId)
    const cust = customers.find(c => c.id === customerId)
    if (cust?.branchId) setBranchId(cust.branchId)
    const nextVehicles = vehicles.filter(v => v.customerId === customerId || !v.customerId)
    if (nextVehicles.length > 0) {
      if (!nextVehicles.some(v => v.id === selectedVehicleId)) {
        setSelectedVehicleId(nextVehicles[0].id)
      }
    } else {
      setSelectedVehicleId('')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return setError('Sign in to create a job card.')
    const custId = manualMode ? manualCustomerId.trim() : selectedCustomerId
    const vehId = manualMode ? manualVehicleId.trim() : selectedVehicleId
    if (!custId) return setError('Please select or specify a customer.')
    if (!vehId) return setError('Please select or specify a vehicle.')

    setBusy(true)
    setError('')
    try {
      await createJobCard(token, {
        branchId,
        customerId: custId,
        vehicleId: vehId,
        complaint: complaint.trim() || undefined,
        odometer: odometer ? Number(odometer) : undefined
        ,packageId: packageId || undefined
        ,isWarranty
        ,warrantyRef: warrantyRef.trim() || undefined
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create job card.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">WORKSHOP / SERVICE</p>
            <h2>New job card</h2>
            <p>Open a service job for a customer and vehicle.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          {loading && <p style={{ fontSize: '13px', color: '#64748b' }}>Loading registered customers and vehicles…</p>}

          {!manualMode ? (
            <>
              <label>
                Customer
                <select
                  value={selectedCustomerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                  disabled={loading || customers.length === 0}
                >
                  {customers.length === 0 && <option value="">No registered customers found</option>}
                  {customers.map(c => {
                    const code = c.sourceId || c.customerCode
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {code ? `· [${code}]` : ''} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    )
                  })}
                </select>
              </label>

              <label>
                Vehicle
                <select
                  value={selectedVehicleId}
                  onChange={e => setSelectedVehicleId(e.target.value)}
                  disabled={loading || matchingVehicles.length === 0}
                >
                  {matchingVehicles.length === 0 && <option value="">No vehicles available for this customer</option>}
                  {matchingVehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.make || ''} {v.model || ''} - {v.registrationNo || 'No registration'} {v.customerId ? '' : '(Unlinked)'}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="form-row">
                <label>
                  Branch
                  <input required value={branchId} onChange={e => setBranchId(e.target.value)} />
                </label>
              </div>
              <label>
                Customer ID
                <input
                  required
                  value={manualCustomerId}
                  onChange={e => setManualCustomerId(e.target.value)}
                  placeholder="Database Customer ID (e.g. cmv...)"
                />
              </label>
              <label>
                Vehicle ID
                <input
                  required
                  value={manualVehicleId}
                  onChange={e => setManualVehicleId(e.target.value)}
                  placeholder="Database Vehicle ID (e.g. cmv...)"
                />
              </label>
            </>
          )}

          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: '12px', padding: 0 }}
              onClick={() => {
                setManualMode(!manualMode)
                setError('')
              }}
            >
              {manualMode ? '← Use customer & vehicle dropdowns' : 'Need manual ID entry?'}
            </button>
          </div>

          <label>
            Odometer reading (km) <span className="optional">optional</span>
            <input
              type="number"
              min="0"
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
              placeholder="e.g. 45000"
            />
          </label>

          <label>
            Service package <span className="optional">optional</span>
            <select value={packageId} onChange={e => setPackageId(e.target.value)} disabled={loading}>
              <option value="">No package selected</option>
              {packages.map(item => <option key={item.id} value={item.id}>{item.name} · {money(Number(item.price))}</option>)}
            </select>
          </label>

          <label className="checkbox-row">
            <input type="checkbox" checked={isWarranty} onChange={e => setIsWarranty(e.target.checked)} />
            Warranty job
          </label>

          {isWarranty && <label>
            Warranty reference
            <input required value={warrantyRef} onChange={e => setWarrantyRef(e.target.value)} placeholder="Warranty claim/reference" />
          </label>}

          <label>
            Customer concern <span className="optional">optional</span>
            <textarea
              value={complaint}
              onChange={e => setComplaint(e.target.value)}
              placeholder="Customer concern, requested inspection, or service work required…"
              rows={3}
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Creating…' : 'Create job card'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export function LoginScreen() {
  const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!identifier.trim()) return setError('Enter your username or email.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setIsSubmitting(true)
    try {
      await signIn(identifier.trim(), password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Check your details and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="login-shell">
    <section className="login-panel">
      <div className="login-brand"><div className="brand-mark">G</div><div><strong>GATEWAY</strong><span>MOTORS</span></div></div>
      <div className="login-copy"><p className="eyebrow">DEALERSHIP OPERATIONS</p><h1>Welcome back</h1><p>Sign in to continue to your dealership workspace.</p></div>
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="identifier">Username or email<input id="identifier" type="text" autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="e.g. jordan.davis" disabled={isSubmitting} /></label>
        <label htmlFor="password">Password<input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" disabled={isSubmitting} /></label>
        {error && <p className="login-error" role="alert"><Icon name="alert" size={15} /> {error}</p>}
        <button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting && <span className="spinner spinner-light" />} {isSubmitting ? 'Signing in…' : 'Sign in'} {!isSubmitting && <Icon name="arrow" size={16} />}</button>
      </form>
      <div className="demo-accounts">
        <p className="demo-title">Test role access (click to autofill):</p>
        <div className="demo-pills">
          {[
            { label: 'Director', user: 'director' },
            { label: 'Cashier', user: 'cashier' },
            { label: 'Salesperson', user: 'salesperson' },
            { label: 'Sales Mgr', user: 'sales.manager' },
            { label: 'Accounts', user: 'accounts' },
            { label: 'Parts Mgr', user: 'parts.manager' },
            { label: 'Service Adv', user: 'service.advisor' },
            { label: 'Body & Paint', user: 'bodypaint.advisor' },
            { label: 'Technician', user: 'technician' },
            { label: 'Admin', user: 'admin' },
          ].map(p => (
            <button
              key={p.user}
              type="button"
              className="demo-pill"
              onClick={() => {
                setIdentifier(p.user)
                setPassword('')
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="login-footnote">Secure access for authorised Gateway Motors personnel.</p>
    </section>
    <aside className="login-aside"><div className="aside-grid" /><div><p className="eyebrow">GATEWAY MOTORS / CONTROL CENTRE</p><h2>One view of every moving part.</h2><p>Keep sales, workshop, inventory and customer operations in sync from a single workspace.</p></div><span className="aside-code">SYSTEM ONLINE · 24.10.2024</span></aside>
  </main>
}

function Kpi({ icon, label, value, delta, context, tone }: { icon: IconName; label: string; value: string; delta: string; context: string; tone: string }) { return <article className="kpi-card"><div className={`kpi-icon ${tone}`}><Icon name={icon} size={19} /></div><div className="kpi-body"><span>{label}</span><strong>{value}</strong><small><b>↑ {delta}</b> {context}</small></div><Icon name="arrow" size={16} /></article> }
function PanelHeader({ title, meta, action }: { title: string; meta?: string; action?: string }) { return <div className="panel-header"><h2>{title}</h2>{meta && <span className="period-select">{meta} <span>⌄</span></span>}{action && <button className="panel-action">{action} <Icon name="arrow" size={14} /></button>}</div> }
function Legend({ color, label, value, percent }: { color: string; label: string; value: string; percent: string }) { return <div className="legend-row"><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{value}</strong><small>{percent}</small></div> }

export default App`r`n