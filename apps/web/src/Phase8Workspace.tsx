import { useEffect, useState } from 'react'
import {
  createAdminUser,
  createAdminDepartment,
  decideApproval,
  exportReporting,
  getAdminDepartments,
  getAdminApprovalRules,
  getAdminPermissions,
  getAdminRoles,
  getAdminUsers,
  getApprovalInbox,
  getAuditEvents,
  getReportingDrilldown,
  getReportingKpis,
  getReportingMetadata,
  getReportingProfitability,
  getReportingSummary,
  updateUserAccess,
  type AdminDepartment,
  type AdminPermission,
  type AdminRole,
  type AdminUser,
  type ApprovalInbox,
  type ApprovalRule,
  type AuditEvent,
  type ProfitabilityReport,
  type ReportFilter,
  type ReportingKpis,
} from './api'

const demoKpis: ReportingKpis = {
  filters: {},
  sales: { customers: 0, bookings: 0 },
  service: { openJobs: 0 },
  bodyPaint: { openOrders: 0 },
  parts: { stockQuantity: 0 },
  finance: { receivablesOutstanding: 0, payablesOutstanding: 0, expenses: 0 },
  cashier: { postedAmount: 0 },
}

const money = (value?: number | string | null) => `Rs. ${Number(value || 0).toLocaleString('en-PK')}`
const can = (permissions: string[], permission: string) => permissions.includes(permission) || permissions.includes('*')

export function DataState({
  loading,
  error,
  empty,
  children,
  retry,
}: {
  loading: boolean
  error?: string
  empty?: boolean
  children: React.ReactNode
  retry: () => void
}) {
  if (loading)
    return (
      <div className="sales-state">
        <span className="spinner" />
        <strong>Loading workspace…</strong>
        <span>Fetching authorised dealership data.</span>
      </div>
    )
  if (error)
    return (
      <div className="sales-state">
        <strong>Couldn’t load this workspace</strong>
        <span>{error}</span>
        <button className="text-button" onClick={retry}>
          Retry
        </button>
      </div>
    )
  if (empty)
    return (
      <div className="sales-state">
        <strong>No records found</strong>
        <span>Try changing the filters.</span>
      </div>
    )
  return <>{children}</>
}

export function DashboardGraphs({ kpis }: { kpis: ReportingKpis }) {
  const workloadItems = [
    { label: 'Parts Stock', count: Number(kpis.parts.stockQuantity || 0), color: '#3c83e6' },
    { label: 'Service Jobs', count: Number(kpis.service.openJobs || 0), color: '#f59e0b' },
    { label: 'Customers', count: Number(kpis.sales.customers || 0), color: '#10b981' },
    { label: 'Bookings', count: Number(kpis.sales.bookings || 0), color: '#8b5cf6' },
    { label: 'Body & Paint', count: Number(kpis.bodyPaint.openOrders || 0), color: '#ec4899' },
  ]
  const totalOperations = workloadItems.reduce((acc, curr) => acc + curr.count, 0)
  const maxWorkload = Math.max(...workloadItems.map((i) => i.count), 1)

  let currentDegree = 0
  const gradientStops = workloadItems
    .map((item) => {
      const pct = totalOperations > 0 ? item.count / totalOperations : 0.2
      const startDeg = currentDegree
      const endDeg = currentDegree + pct * 360
      currentDegree = endDeg
      return `${item.color} ${startDeg.toFixed(1)}deg ${endDeg.toFixed(1)}deg`
    })
    .join(', ')

  const cashReceived = Number(kpis.cashier.postedAmount || 0)
  const receivables = Number(kpis.finance.receivablesOutstanding || 0)
  const payables = Number(kpis.finance.payablesOutstanding || 0)
  const expenses = Number(kpis.finance.expenses || 0)
  const totalVolume = cashReceived + receivables + payables + expenses
  const maxFinance = Math.max(cashReceived, receivables, payables, expenses, 1)

  const financeItems = [
    { label: 'Cash Received (Inflow)', amount: cashReceived, color: '#10b981' },
    { label: 'Receivables Outstanding (Due)', amount: receivables, color: '#f59e0b' },
    { label: 'Payables Outstanding (Due)', amount: payables, color: '#0284c7' },
    { label: 'Operating Expenses (Paid)', amount: expenses, color: '#ef4444' },
  ]

  return (
    <section className="dashboard-graphs-grid">
      <article className="dashboard-graph-card">
        <div className="graph-header">
          <div>
            <h2>Dealership Operations & Workload</h2>
            <p>Live departmental volume and inventory distribution</p>
          </div>
          <span className="graph-badge">{totalOperations} Total Units</span>
        </div>

        <div className="workload-graph-content">
          <div className="donut-wrap" style={{ width: '42%' }}>
            <div
              className="donut"
              style={{
                background: totalOperations > 0 ? `conic-gradient(${gradientStops})` : '#e2e8f0',
              }}
            >
              <div>
                <strong>{totalOperations}</strong>
                <span>Active volume</span>
              </div>
            </div>
            <div className="donut-legend">
              {workloadItems.map((item) => {
                const pct = totalOperations > 0 ? Math.round((item.count / totalOperations) * 100) : 0
                return (
                  <div className="legend-row" key={item.label}>
                    <span className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                    <small>{pct}% of volume</small>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="workload-bars-wrap">
            <div className="workload-bars">
              {workloadItems.map((item) => {
                const heightPct = Math.max(Math.round((item.count / maxWorkload) * 100), item.count > 0 ? 12 : 4)
                return (
                  <div className="workload-bar-col" key={item.label}>
                    <span className="workload-bar-val">{item.count}</span>
                    <div
                      className="workload-bar-fill"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: item.color,
                      }}
                      title={`${item.label}: ${item.count}`}
                    />
                    <span className="workload-bar-label">{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </article>

      <article className="dashboard-graph-card">
        <div className="graph-header">
          <div>
            <h2>Financial Cash Flow & Balances</h2>
            <p>Cash inflow, receivables, payables, and operating expenses</p>
          </div>
          <span className="graph-badge" style={{ background: '#f8fafc', color: '#334155', borderColor: '#e2e8f0' }}>
            {money(totalVolume)} Tracked
          </span>
        </div>

        <div className="finance-flow-list">
          {financeItems.map((item) => {
            const widthPct = Math.max(Math.round((item.amount / maxFinance) * 100), item.amount > 0 ? 8 : 2)
            return (
              <div className="finance-flow-row" key={item.label}>
                <div className="finance-flow-meta">
                  <span>
                    <i style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                  <strong>{money(item.amount)}</strong>
                </div>
                <div className="finance-flow-track">
                  <div
                    className="finance-flow-bar"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </article>
    </section>
  )
}

function ProfitabilityWidget({
  profitability,
  basis,
  onBasisChange,
}: {
  profitability: ProfitabilityReport | null
  basis: 'accrual' | 'cash'
  onBasisChange: (next: 'accrual' | 'cash') => void
}) {
  if (!profitability) return null

  const p = profitability
  return (
    <section className="panel" style={{ marginTop: '20px' }}>
      <div
        className="panel-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h2>Profitability & Financial Reconciliation</h2>
          <p style={{ color: 'var(--muted, #666)', fontSize: '0.88rem', margin: 0 }}>
            Distinction between bookings pipeline, invoiced revenue, cash receipts, outstanding debt, and net profit.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Accounting Basis:</span>
          <div className="sales-tabs" style={{ margin: 0 }}>
            <button
              className={basis === 'accrual' ? 'active' : ''}
              onClick={() => onBasisChange('accrual')}
              style={{ padding: '4px 12px', fontSize: '0.82rem' }}
            >
              Accrual Basis
            </button>
            <button
              className={basis === 'cash' ? 'active' : ''}
              onClick={() => onBasisChange('cash')}
              style={{ padding: '4px 12px', fontSize: '0.82rem' }}
            >
              Cash Basis
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginTop: '16px',
        }}
      >
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Bookings Pipeline</span>
          <strong style={{ color: '#8b5cf6' }}>{p.bookingsCount} orders</strong>
          <small>Unbilled commitments</small>
        </div>
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Invoiced Sales</span>
          <strong style={{ color: '#0284c7' }}>{money(p.invoicedSales)}</strong>
          <small>Total sales billed</small>
        </div>
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Cash Collected</span>
          <strong style={{ color: '#10b981' }}>{money(p.cashReceived)}</strong>
          <small>Cashier receipts</small>
        </div>
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Outstanding Due</span>
          <strong style={{ color: '#f59e0b' }}>{money(p.outstandingReceivables)}</strong>
          <small>Uncollected balance</small>
        </div>
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Invoiced vs Cash Gap</span>
          <strong style={{ color: p.invoicedVsCashDifference > 0 ? '#ef4444' : '#10b981' }}>
            {money(p.invoicedVsCashDifference)}
          </strong>
          <small>{p.collectionsRate}% collected</small>
        </div>
        <div className="phase-kpi panel" style={{ margin: 0 }}>
          <span>Operating Profit ({basis})</span>
          <strong style={{ color: p.operatingProfit >= 0 ? '#10b981' : '#ef4444' }}>
            {money(p.operatingProfit)}
          </strong>
          <small>{p.operatingMarginPct}% net margin</small>
        </div>
      </div>
    </section>
  )
}

export function DashboardWorkspace({ token, permissions }: { token: string | null; permissions: string[] }) {
  const [filters, setFilters] = useState<ReportFilter>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  })
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual')
  const [kpis, setKpis] = useState(demoKpis)
  const [profitability, setProfitability] = useState<ProfitabilityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [fallback, setFallback] = useState(false)
  const [source, setSource] = useState('')
  const [drill, setDrill] = useState<Array<Record<string, unknown>>>([])
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token || !can(permissions, 'reporting.dashboard.read')) {
      setLoading(false)
      setFallback(true)
      return () => {
        mounted = false
      }
    }

    Promise.all([
      getReportingKpis(token, filters),
      getReportingProfitability(token, { ...filters, basis }),
    ])
      .then(([kpiVal, profVal]) => {
        if (!mounted) return
        setKpis(kpiVal)
        setProfitability(profVal)
        setFallback(false)
      })
      .catch(() => mounted && setFallback(true))
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [token, permissions, filters, basis, refresh])

  async function openDrill(next: string) {
    setSource(next)
    if (!token || !can(permissions, 'reporting.report.read')) return
    try {
      const result = await getReportingDrilldown(token, next, { ...filters, pageSize: 12 })
      setDrill(result.data)
    } catch {
      setDrill([])
    }
  }

  function handlePeriodChange(p: string) {
    if (!p) {
      setFilters({
        ...filters,
        period: undefined,
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
      })
    } else {
      setFilters({ ...filters, period: p, from: undefined, to: undefined })
    }
  }

  const cards = [
    { label: 'Customers', value: kpis.sales.customers.toLocaleString(), source: 'sales' },
    { label: 'Bookings', value: kpis.sales.bookings.toLocaleString(), source: 'sales' },
    { label: 'Open service jobs', value: kpis.service.openJobs, source: 'service' },
    { label: 'Body & Paint orders', value: kpis.bodyPaint.openOrders, source: 'body-paint' },
    { label: 'Stock units', value: kpis.parts.stockQuantity.toLocaleString(), source: 'parts' },
    { label: 'Cash received', value: money(kpis.cashier.postedAmount), source: 'cashier' },
    { label: 'Receivables outstanding', value: money(kpis.finance.receivablesOutstanding), source: 'finance' },
    { label: 'Payables outstanding', value: money(kpis.finance.payablesOutstanding), source: 'finance' },
  ]

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">
            DIRECTOR DASHBOARD <span className="live-pill"><i /> LIVE</span>
          </p>
          <h1>Dealership Executive Overview <span>✦</span></h1>
          <p className="subtitle">Real-time performance across sales, service, body & paint, parts, finance and cashier.</p>
        </div>
      </section>

      <div
        className="phase-toolbar panel"
        style={{ minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
      >
        <label>
          Period Preset
          <select value={filters.period ?? ''} onChange={(e) => handlePeriodChange(e.target.value)}>
            <option value="">Custom Range</option>
            <option value="daily">Today (Daily)</option>
            <option value="monthly">This Month (Monthly)</option>
            <option value="annual">This Year (Annual)</option>
          </select>
        </label>
        {!filters.period && (
          <>
            <label>
              From
              <input type="date" value={filters.from ?? ''} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </label>
            <label>
              To
              <input type="date" value={filters.to ?? ''} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </label>
          </>
        )}
        <label>
          Branch
          <input
            placeholder="All branches"
            value={filters.branchId ?? ''}
            onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
          />
        </label>
        <button className="secondary-button" onClick={() => setRefresh((v) => v + 1)}>
          Refresh
        </button>
      </div>

      {fallback && (
        <div className="demo-banner">
          <strong>Demo fallback active.</strong>
          <span>Reporting API unavailable or permission is not granted.</span>
          <button onClick={() => setRefresh((v) => v + 1)}>Retry</button>
        </div>
      )}

      <DataState loading={loading} retry={() => setRefresh((v) => v + 1)}>
        <DashboardGraphs kpis={kpis} />
        <ProfitabilityWidget profitability={profitability} basis={basis} onBasisChange={setBasis} />
        <section className="phase-kpi-grid" style={{ marginTop: '20px' }}>
          {cards.map((card) => (
            <button className="phase-kpi panel" key={card.label} onClick={() => openDrill(card.source)}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>View permitted drill-down →</small>
            </button>
          ))}
        </section>
      </DataState>

      {source && (
        <section className="panel phase-drill">
          <div className="panel-header">
            <h2>{source.toUpperCase()} Permitted Drill-Down</h2>
            <button className="panel-action" onClick={() => setSource('')}>
              Close
            </button>
          </div>
          <DataState loading={false} retry={() => undefined} empty={!drill.length}>
            <div className="phase-list">
              {drill.map((row) => (
                <div key={String(row.id)}>
                  <strong>
                    {String(
                      row.bookingNo ??
                        row.jobNo ??
                        row.orderNo ??
                        row.description ??
                        row.itemCode ??
                        row.action ??
                        row.id,
                    )}
                  </strong>
                  <span>
                    {String(
                      row.status ??
                        row.type ??
                        (row.quantity !== undefined
                          ? `${Number(row.quantity).toLocaleString()} in stock`
                          : row.entityType ?? 'Record'),
                    )}{' '}
                    ·{' '}
                    {String(
                      row.branchId ??
                        (row.location && typeof row.location === 'object'
                          ? ((row.location as any).name || (row.location as any).code)
                          : '') ??
                        row.createdAt ??
                        '',
                    )}
                  </span>
                </div>
              ))}
            </div>
          </DataState>
        </section>
      )}
    </>
  )
}

function formatReportKey(key: string) {
  switch (key) {
    case 'sales':
      return { title: 'Vehicle Sales & Bookings', eyebrow: 'SALES & ORDERS', unit: 'bookings' }
    case 'service':
      return { title: 'Workshop Service Jobs', eyebrow: 'WORKSHOP DESK', unit: 'job cards' }
    case 'bodyPaint':
      return { title: 'Body & Paint Operations', eyebrow: 'COLLISION & REPAIR', unit: 'orders' }
    case 'parts':
      return { title: 'Parts Stock Balances', eyebrow: 'SPARE PARTS', unit: 'units' }
    case 'finance':
      return { title: 'Operating Expenses', eyebrow: 'ACCOUNTS & FINANCE', unit: 'expenses' }
    case 'cashier':
      return { title: 'Daily Cashier Sessions', eyebrow: 'CASHIER DESK', unit: 'sessions' }
    default:
      return {
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        eyebrow: 'MODULE SUMMARY',
        unit: 'items',
      }
  }
}

function statusColor(status: string): string {
  const s = status.toUpperCase()
  if (['CONFIRMED', 'DELIVERED', 'CLOSED', 'PAID', 'APPROVED', 'ACTIVE', 'POSTED'].includes(s)) return '#10b981'
  if (['OPEN', 'IN_PROGRESS', 'PAINTING', 'WAITING_PARTS', 'ASSESSMENT'].includes(s)) return '#0284c7'
  if (['PENDING', 'RESERVED', 'PENDING_APPROVAL', 'ESTIMATED'].includes(s)) return '#f59e0b'
  if (['CANCELLED', 'REJECTED', 'FAILED', 'REVERSED'].includes(s)) return '#ef4444'
  return '#64748b'
}

interface GroupByCountItem {
  status: string
  _count?: { _all?: number }
}

interface PartsItem {
  itemCode: string
  quantity: number
  location?: { branchId?: string; code?: string }
}

interface FinanceItem {
  status: string
  amount: number
}

function ReportSummaryCard({ sourceKey, data }: { sourceKey: string; data: unknown }) {
  const [showRaw, setShowRaw] = useState(false)
  const meta = formatReportKey(sourceKey)

  const isPartsList = sourceKey === 'parts' && Array.isArray(data)
  const isFinanceList = sourceKey === 'finance' && Array.isArray(data)
  const isGroupByCounts =
    Array.isArray(data) &&
    (data.length === 0 || (typeof data[0] === 'object' && data[0] !== null && 'status' in data[0] && '_count' in data[0]))

  function renderBody() {
    if (isPartsList) {
      const items = (data as PartsItem[]) || []
      const totalUnits = items.reduce((s, x) => s + (Number(x.quantity) || 0), 0)
      if (items.length === 0) {
        return (
          <div className="report-empty-notice">
            <p>No inventory balances found</p>
            <small>Spare parts stock levels will appear here</small>
          </div>
        )
      }
      return (
        <>
          <div className="report-hero-metric">
            <strong>{totalUnits.toLocaleString()}</strong>
            <span>in-stock units across {items.length} item{items.length === 1 ? '' : 's'}</span>
          </div>
          <table className="report-parts-table">
            <thead>
              <tr>
                <th>Part SKU</th>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td><strong>{item.itemCode}</strong></td>
                  <td><small>{item.location?.code || 'MAIN'}</small></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`report-qty-pill ${item.quantity <= 10 ? 'low' : 'normal'}`}>
                      {item.quantity} units {item.quantity <= 10 ? '⚠️' : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )
    }

    if (isFinanceList) {
      const items = (data as FinanceItem[]) || []
      const totalExpense = items.reduce((s, x) => s + (Number(x.amount) || 0), 0)
      if (items.length === 0) {
        return (
          <div className="report-empty-notice">
            <p>No expense transactions recorded</p>
            <small>Payables and workshop expenses will appear here</small>
          </div>
        )
      }
      return (
        <>
          <div className="report-hero-metric">
            <strong>{money(totalExpense)}</strong>
            <span>total operating expenses</span>
          </div>
          <div className="report-breakdown-list">
            {items.map((item, idx) => {
              const pct = totalExpense > 0 ? Math.round((Number(item.amount) / totalExpense) * 100) : 0
              const color = statusColor(item.status)
              return (
                <div key={idx} className="report-breakdown-row">
                  <div className="report-breakdown-info">
                    <span className="report-status-tag" style={{ background: `${color}18`, color }}>
                      <i style={{ backgroundColor: color }} />
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    <span className="report-breakdown-count">
                      <strong>{money(item.amount)}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    if (isGroupByCounts) {
      const items = (data as GroupByCountItem[]) || []
      const total = items.reduce((acc, curr) => acc + (curr._count?._all ?? 0), 0)
      if (items.length === 0) {
        return (
          <div className="report-empty-notice">
            <p>No records for this date range</p>
            <small>Active {meta.unit} will appear here</small>
          </div>
        )
      }
      return (
        <>
          <div className="report-hero-metric">
            <strong>{total.toLocaleString()}</strong>
            <span>total {meta.unit} recorded</span>
          </div>
          <div className="report-breakdown-list">
            {items.map((item, idx) => {
              const count = item._count?._all ?? 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const color = statusColor(item.status)
              return (
                <div key={idx} className="report-breakdown-row">
                  <div className="report-breakdown-info">
                    <span className="report-status-tag" style={{ background: `${color}18`, color }}>
                      <i style={{ backgroundColor: color }} />
                      {item.status.replace(/_/g, ' ')}
                    </span>
                    <span className="report-breakdown-count">
                      <strong>{count}</strong> ({pct}%)
                    </span>
                  </div>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return <div className="report-empty-notice"><p>No entries recorded</p></div>
      return (
        <div className="report-breakdown-list">
          {data.map((row, idx) => (
            <div key={idx} className="report-breakdown-info" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <strong>Row #{idx + 1}</strong>
              <span>{typeof row === 'object' && row !== null ? Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ') : String(row)}</span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="report-breakdown-list">
        {Object.entries((data as Record<string, unknown>) || {}).map(([k, v]) => (
          <div key={k} className="report-breakdown-info" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span>{k.replace(/([A-Z])/g, ' $1')}</span>
            <strong>{typeof v === 'number' ? v.toLocaleString() : String(v)}</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <article className="report-card">
      <div className="report-card-header">
        <div>
          <div className="report-card-eyebrow">{meta.eyebrow}</div>
          <h2>{meta.title}</h2>
        </div>
        <span className="report-badge-pill">{sourceKey}</span>
      </div>

      {renderBody()}

      <div className="report-raw-footer">
        <button
          type="button"
          className="report-raw-toggle"
          onClick={() => setShowRaw(!showRaw)}
        >
          {showRaw ? '▾ Hide technical payload' : '▸ View technical payload'}
        </button>
        {showRaw && (
          <pre className="report-raw-content">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </article>
  )
}

export function ReportingWorkspace({ token, permissions }: { token: string | null; permissions: string[] }) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null)
  const [metadata, setMetadata] = useState<{ sources: string[]; generatedAt: string } | null>(null)
  const [filter, setFilter] = useState<ReportFilter>({})
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token || !can(permissions, 'reporting.report.read')) {
      setLoading(false)
      return () => {
        mounted = false
      }
    }
    Promise.all([getReportingSummary(token, filter), getReportingMetadata(token)])
      .then(([next, info]) => mounted && (setSummary(next as unknown as Record<string, unknown>), setMetadata(info)))
      .catch(() => mounted && setSummary(null))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [token, permissions, filter, refresh])

  async function exportSource(source: string) {
    if (!token || !can(permissions, 'reporting.export')) return setNotice('You do not have export permission.')
    try {
      const result = await exportReporting(token, source, { ...filter, format: exportFormat })
      let blob: Blob
      let filename = `${source}-report.${exportFormat}`

      if (exportFormat === 'csv' && result.csv) {
        blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
        filename = result.filename || `${source}-report.csv`
      } else {
        blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
        filename = `${source}-report.json`
      }

      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice(`Export for ${source} (${exportFormat.toUpperCase()}) downloaded successfully.`)
    } catch {
      setNotice('Export could not be prepared.')
    }
  }

  function handlePeriodChange(p: string) {
    if (!p) {
      setFilter({ ...filter, period: undefined })
    } else {
      setFilter({ ...filter, period: p, from: undefined, to: undefined })
    }
  }

  const sources = metadata?.sources ?? [
    'sales',
    'service',
    'body-paint',
    'parts',
    'finance',
    'cashier',
    'audit',
    'profitability',
  ]

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">REPORTING WORKSPACE</p>
          <h1>Dealership Reports & Audited Exports</h1>
          <p className="subtitle">Operational module summaries, profitability metrics, and permission-controlled exports.</p>
        </div>
      </section>

      <div
        className="phase-toolbar panel"
        style={{ minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}
      >
        <label>
          Period Preset
          <select value={filter.period ?? ''} onChange={(e) => handlePeriodChange(e.target.value)}>
            <option value="">Custom Date Range</option>
            <option value="daily">Today (Daily)</option>
            <option value="monthly">This Month (Monthly)</option>
            <option value="annual">This Year (Annual)</option>
          </select>
        </label>
        {!filter.period && (
          <>
            <label>
              From
              <input type="date" value={filter.from ?? ''} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
            </label>
            <label>
              To
              <input type="date" value={filter.to ?? ''} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
            </label>
          </>
        )}
        <label>
          Export Format
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json')}>
            <option value="csv">CSV (Excel Compatible)</option>
            <option value="json">JSON (Structured Payload)</option>
          </select>
        </label>
        <button className="secondary-button" onClick={() => setRefresh((v) => v + 1)}>
          Refresh
        </button>
      </div>

      {notice && <div className="success-banner" style={{ margin: '14px 0' }}>{notice}</div>}

      <section className="report-grid">
        <DataState loading={loading} retry={() => setRefresh((v) => v + 1)} empty={!summary}>
          <div className="report-summary-grid">
            {Object.entries(summary ?? {}).map(([key, value]) => (
              <ReportSummaryCard key={key} sourceKey={key} data={value} />
            ))}
          </div>
        </DataState>
      </section>

      <section className="panel export-panel" style={{ minHeight: 'auto', marginTop: '20px' }}>
        <div className="panel-header">
          <h2>Authorised Data Exports ({exportFormat.toUpperCase()})</h2>
          <span className="finance-meta">
            {metadata ? `Live Catalog · ${sources.length} sources available` : 'Metadata loading…'}
          </span>
        </div>
        <div className="export-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {sources.map((source) => (
            <button
              className="secondary-button"
              key={source}
              onClick={() => exportSource(source)}
              disabled={!can(permissions, 'reporting.export')}
            >
              Export {source}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}

export function AdministrationWorkspace({
  token,
  permissions,
  currentUserId,
}: {
  token: string | null
  permissions: string[]
  currentUserId?: string
}) {
  if (!can(permissions, 'users.manage')) {
    return (
      <div className="state-message error-state" style={{ margin: '40px auto', maxWidth: '640px', textAlign: 'center' }}>
        <h2>Access Restricted</h2>
        <p>Administration and user access management is restricted to System Administrators and Directors.</p>
      </div>
    )
  }

  const [tab, setTab] = useState<'users' | 'departments' | 'roles' | 'approvals' | 'rules' | 'audit'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [departments, setDepartments] = useState<AdminDepartment[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [perms, setPerms] = useState<AdminPermission[]>([])
  const [approvals, setApprovals] = useState<ApprovalInbox | null>(null)
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [audits, setAudits] = useState<AuditEvent[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [showAddUser, setShowAddUser] = useState(false)
  const [showAddDept, setShowAddDept] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError('')
    if (!token) {
      setLoading(false)
      return () => {
        mounted = false
      }
    }

    if (can(permissions, 'users.manage') && roles.length === 0) {
      getAdminRoles(token).then((r) => {
        if (mounted) setRoles(r)
      }).catch(() => {})
    }

    const load =
      tab === 'users' && can(permissions, 'users.manage')
        ? getAdminUsers(token, { query, pageSize: 50 })
        : tab === 'departments' && can(permissions, 'users.manage')
        ? getAdminDepartments(token)
        : tab === 'roles' && can(permissions, 'users.manage')
        ? Promise.all([getAdminRoles(token), getAdminPermissions(token)]).then(([r, p]) => {
            if (mounted) {
              setRoles(r)
              setPerms(p)
            }
            return null
          })
        : tab === 'approvals' && can(permissions, 'approvals.inbox.read')
        ? getApprovalInbox(token)
        : tab === 'rules' && can(permissions, 'approvals.inbox.read')
        ? getAdminApprovalRules(token)
        : tab === 'audit' && can(permissions, 'audit.view')
        ? getAuditEvents(token, { query, pageSize: 25 })
        : Promise.reject(new Error('You do not have permission to view this area.'))

    load
      .then((result) => {
        if (!mounted || !result) return
        if (tab === 'users') setUsers((result as { data: AdminUser[] }).data)
        if (tab === 'departments') setDepartments(result as AdminDepartment[])
        if (tab === 'approvals') setApprovals(result as ApprovalInbox)
        if (tab === 'rules') setRules(result as ApprovalRule[])
        if (tab === 'audit') setAudits((result as { data: AuditEvent[] }).data)
      })
      .catch((cause) => mounted && setError(cause instanceof Error ? cause.message : 'Unable to load administration data.'))
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [token, permissions, tab, query, refresh])

  async function decision(kind: string, id: string, decisionValue: 'APPROVE' | 'REJECT') {
    if (!token || !can(permissions, 'approvals.decide')) return
    try {
      await decideApproval(token, kind, id, decisionValue)
      setRefresh((v) => v + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Decision failed.')
    }
  }

  async function toggleActive(user: AdminUser) {
    if (!token || user.id === currentUserId) return
    try {
      await updateUserAccess(token, user.id, { isActive: !user.isActive })
      setNotice(`User ${user.username} is now ${!user.isActive ? 'Active' : 'Inactive'}.`)
      setRefresh((v) => v + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update account status.')
    }
  }

  const tabs = [
    { id: 'users' as const, label: 'Users & access' },
    { id: 'departments' as const, label: 'Departments' },
    { id: 'roles' as const, label: 'Roles & permissions' },
    { id: 'approvals' as const, label: 'Approval inbox' },
    { id: 'rules' as const, label: 'Approval rules' },
    { id: 'audit' as const, label: 'Audit search' },
  ].filter((t) => {
    if (t.id === 'users' || t.id === 'departments' || t.id === 'roles') return can(permissions, 'users.manage')
    if (t.id === 'approvals' || t.id === 'rules') return can(permissions, 'approvals.inbox.read')
    if (t.id === 'audit') return can(permissions, 'audit.view')
    return false
  })

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Dealership Access & Governance</h1>
          <p className="subtitle">Manage user accounts, department organization, roles, permissions, approval limits, and audit trails.</p>
        </div>
      </section>

      <div className="sales-tabs phase-tabs">
        {tabs.map((item) => (
          <button
            className={tab === item.id ? 'active' : ''}
            onClick={() => {
              setTab(item.id)
              setError('')
            }}
            key={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="phase-toolbar panel"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}
      >
        <label style={{ flex: '1 1 200px' }}>
          Search
          <input placeholder="Search records…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="secondary-button" onClick={() => setRefresh((v) => v + 1)}>
            Refresh
          </button>
          {tab === 'users' && can(permissions, 'users.manage') && (
            <button className="primary-button" onClick={() => setShowAddUser(true)}>
              + Add new user
            </button>
          )}
          {tab === 'departments' && can(permissions, 'users.manage') && (
            <button className="primary-button" onClick={() => setShowAddDept(true)}>
              + Add department
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="success-banner" style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✓ {notice}</span>
          <button
            onClick={() => setNotice('')}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      <section className="panel admin-panel">
        <DataState
          loading={loading}
          error={error}
          retry={() => setRefresh((v) => v + 1)}
          empty={!users.length && tab === 'users' && !error}
        >
          <AdminContent
            tab={tab}
            users={users}
            departments={departments}
            roles={roles}
            perms={perms}
            approvals={approvals}
            rules={rules}
            audits={audits}
            currentUserId={currentUserId}
            onDecision={decision}
            onEditUser={setEditingUser}
            onToggleActive={toggleActive}
          />
        </DataState>
      </section>

      {showAddUser && (
        <AddUserModal
          token={token}
          roles={roles}
          onClose={() => setShowAddUser(false)}
          onDone={(msg) => {
            setShowAddUser(false)
            setNotice(msg)
            setRefresh((v) => v + 1)
          }}
        />
      )}

      {showAddDept && (
        <AddDepartmentModal
          token={token}
          onClose={() => setShowAddDept(false)}
          onDone={(msg) => {
            setShowAddDept(false)
            setNotice(msg)
            setRefresh((v) => v + 1)
          }}
        />
      )}

      {editingUser && (
        <EditUserAccessModal
          token={token}
          user={editingUser}
          roles={roles}
          currentUserId={currentUserId}
          onClose={() => setEditingUser(null)}
          onDone={(msg) => {
            setEditingUser(null)
            setNotice(msg)
            setRefresh((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

function AdminContent({
  tab,
  users,
  departments,
  roles,
  perms,
  approvals,
  rules,
  audits,
  currentUserId,
  onDecision,
  onEditUser,
  onToggleActive,
}: {
  tab: string
  users: AdminUser[]
  departments: AdminDepartment[]
  roles: AdminRole[]
  perms: AdminPermission[]
  approvals: ApprovalInbox | null
  rules: ApprovalRule[]
  audits: AuditEvent[]
  currentUserId?: string
  onDecision: (kind: string, id: string, decision: 'APPROVE' | 'REJECT') => void
  onEditUser: (user: AdminUser) => void
  onToggleActive: (user: AdminUser) => void
}) {
  if (tab === 'users') {
    return (
      <div className="phase-list">
        {users.map((user) => (
          <div
            key={user.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border, #eee)',
              gap: '16px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1rem' }}>{user.username}</strong>
                <Status value={user.isActive ? 'Active' : 'Inactive'} />
                {user.id === currentUserId && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      padding: '2px 6px',
                      background: 'var(--bg-subtle, #f0f0f0)',
                      borderRadius: '4px',
                    }}
                  >
                    You
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--muted, #666)', fontSize: '0.85rem', marginTop: '4px' }}>
                <span>{user.email}</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span style={{ fontWeight: 500 }}>
                  {user.roles.map((r) => r.name).join(', ') || 'No roles assigned'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <button
                className="secondary-button"
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={() => onEditUser(user)}
              >
                Manage access
              </button>
              {user.id !== currentUserId && (
                <button
                  className={`text-button ${user.isActive ? 'danger' : ''}`}
                  style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                  onClick={() => onToggleActive(user)}
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'departments') {
    return (
      <div className="phase-list">
        {departments.length === 0 ? (
          <div className="sales-state" style={{ padding: '24px 0' }}>
            <strong>No departments registered</strong>
            <span>Create your first department using "+ Add department" above.</span>
          </div>
        ) : (
          departments.map((dept) => (
            <div key={dept.id}>
              <strong>
                {dept.name} <small style={{ color: 'var(--muted, #666)' }}>({dept.code})</small>
              </strong>
              <span>
                {dept.branches.length > 0
                  ? `Branches: ${dept.branches.map((b) => `${b.name} [${b.code}]`).join(', ')}`
                  : 'No branches attached'}
              </span>
            </div>
          ))
        )}
      </div>
    )
  }

  if (tab === 'roles') {
    return (
      <div className="phase-list">
        {roles.map((role) => (
          <div key={role.id}>
            <strong>{role.name}</strong>
            <span>
              {role.description || 'Role access policy'} · {role.permissions.length} permissions configured
            </span>
          </div>
        ))}
        <p className="phase-note">Permission catalogue: {perms.length} configured operational permissions.</p>
      </div>
    )
  }

  if (tab === 'rules') {
    return (
      <div className="phase-list">
        {rules.map((rule) => (
          <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border, #eee)' }}>
            <div>
              <strong>{rule.workflow} · {rule.department}</strong>
              <div style={{ color: 'var(--muted, #666)', fontSize: '0.85rem', marginTop: '4px' }}>
                {rule.description}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span className="status-pill active" style={{ fontSize: '0.78rem' }}>
                Threshold: {rule.thresholdAmount > 0 ? money(rule.thresholdAmount) : 'All values'}
              </span>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted, #666)', marginTop: '4px' }}>
                Requires {rule.requiredRole}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'audit') {
    return (
      <div className="phase-list">
        {audits.map((event) => (
          <div key={event.id}>
            <strong>
              {event.action} · {event.entityType}
            </strong>
            <span>
              {event.actor?.username || 'System'} · {event.entityId || '—'} ·{' '}
              {new Date(event.createdAt).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    )
  }

  const items = [
    ...(approvals?.estimates ?? []).map((item) => ({
      kind: 'estimate',
      id: String(item.id),
      title: `Estimate ${String(item.id)}`,
    })),
    ...(approvals?.expenses ?? []).map((item) => ({
      kind: 'expense',
      id: String(item.id),
      title: `Expense ${String(item.id)}`,
    })),
    ...(approvals?.bodyPaint ?? []).map((item) => ({
      kind: 'body-paint',
      id: String(item.id),
      title: `Body & Paint ${String(item.id)}`,
    })),
  ]

  return (
    <div className="phase-list">
      {items.length === 0 ? (
        <div className="sales-state" style={{ padding: '24px 0' }}>
          <strong>No pending approvals</strong>
          <span>All cross-departmental estimates, expenses, and supplemental repairs are reviewed.</span>
        </div>
      ) : (
        items.map((item) => (
          <div key={`${item.kind}-${item.id}`}>
            <strong>{item.title}</strong>
            <span>Awaiting decision</span>
            <span className="admin-actions">
              <button className="text-button" onClick={() => onDecision(item.kind, item.id, 'APPROVE')}>
                Approve
              </button>
              <button className="text-button danger" onClick={() => onDecision(item.kind, item.id, 'REJECT')}>
                Reject
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function AddUserModal({
  token,
  roles,
  onClose,
  onDone,
}: {
  token: string | null
  roles: AdminRole[]
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !username.trim() || !email.trim()) {
      return setError('Username and Email are required.')
    }
    setBusy(true)
    setError('')
    try {
      await createAdminUser(token, {
        username: username.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        roleIds: selectedRoleIds,
        isActive,
      })
      onDone(`User "${username.trim()}" created with assigned access roles!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create user.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ADMINISTRATION / ACCESS</p>
            <h2>Add new user</h2>
            <p>Create a user account and assign their operational DMS roles.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-row">
            <label>
              Username *
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. john.sales"
              />
            </label>
            <label>
              Email address *
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@gatewaymotors.local"
              />
            </label>
          </div>

          <label>
            Password
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
            <small style={{ color: 'var(--muted, #666)', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
              Default password is pre-filled for easy testing.
            </small>
          </label>

          <div style={{ marginTop: '12px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Assign Roles & Permissions ({selectedRoleIds.length} selected):
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '10px',
                background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                borderRadius: '6px',
                border: '1px solid var(--border, #ccc)',
              }}
            >
              {roles.map((r) => (
                <label
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={(ev) => {
                      if (ev.target.checked) setSelectedRoleIds((ids) => [...ids, r.id])
                      else setSelectedRoleIds((ids) => ids.filter((id) => id !== r.id))
                    }}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active account (permitted to log in)</span>
          </label>

          {error && <p className="form-error">⚠️ {error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Creating user…' : 'Create user & assign roles'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function AddDepartmentModal({
  token,
  onClose,
  onDone,
}: {
  token: string | null
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !code.trim() || !name.trim()) return setError('Code and name are required.')
    setBusy(true)
    setError('')
    try {
      await createAdminDepartment(token, { code: code.trim(), name: name.trim() })
      onDone(`Department "${name.trim()}" (${code.trim()}) registered successfully!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create department.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ADMINISTRATION / ORGANISATION</p>
            <h2>Add department</h2>
            <p>Define an operational business department within Gateway Motors.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Department code *
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. OPERATIONS"
            />
          </label>
          <label style={{ marginTop: '12px' }}>
            Department name *
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dealership Operations"
            />
          </label>
          {error && <p className="form-error">⚠️ {error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Creating department…' : 'Create department'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function EditUserAccessModal({
  token,
  user,
  roles,
  currentUserId,
  onClose,
  onDone,
}: {
  token: string | null
  user: AdminUser
  roles: AdminRole[]
  currentUserId?: string
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(user.roles.map((r) => r.id))
  const [isActive, setIsActive] = useState<boolean>(user.isActive)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isSelf = user.id === currentUserId

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await updateUserAccess(token, user.id, {
        roleIds: selectedRoleIds,
        isActive: isSelf ? undefined : isActive,
      })
      onDone(`Access and roles updated for ${user.username}!`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update access.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ADMINISTRATION / ACCESS</p>
            <h2>Edit access for {user.username}</h2>
            <p>{user.email}</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Assigned Roles & Permissions ({selectedRoleIds.length} selected):
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '10px',
                background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                borderRadius: '6px',
                border: '1px solid var(--border, #ccc)',
              }}
            >
              {roles.map((r) => (
                <label
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', margin: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={(ev) => {
                      if (ev.target.checked) setSelectedRoleIds((ids) => [...ids, r.id])
                      else setSelectedRoleIds((ids) => ids.filter((id) => id !== r.id))
                    }}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '14px',
              cursor: isSelf ? 'not-allowed' : 'pointer',
            }}
          >
            <input type="checkbox" disabled={isSelf} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>
              Active account (permitted to log in)
              {isSelf ? ' — (You cannot deactivate your own account)' : ''}
            </span>
          </label>

          {error && <p className="form-error">⚠️ {error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving changes…' : 'Save access changes'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Status({ value }: { value: string }) {
  return <span className={`status-pill ${value.toLowerCase()}`}>{value}</span>
}
