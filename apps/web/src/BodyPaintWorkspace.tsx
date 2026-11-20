import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createBodyPaintOperation, createDamageAssessment, createRepairOrder, createInsuranceCase, decideRepairApproval, getBodyPaintInvoiceReadySummary, createBodyPaintInvoice, getBodyPaintInvoices, postBodyPaintInvoice, createBodyPaintFinalInspection, deliverBodyPaintOrder, getBodyPaintWorkloadReport,
  getBodyPaintOperations, getDamageAssessments, getMaterialConsumptions, getRepairApprovals, getRepairOrders,
  getVehicleMovements, recordMaterialConsumption, recordVehicleMovement, requestRepairApproval, updateRepairOrderStatus,
  getSalesResource,
  type ApprovalParty, type BodyPaintOperation, type BodyPaintStatus, type DamageAssessment, type MaterialConsumption,
  type RepairApproval, type RepairOrder, type VehicleMovement,
} from './api'

const statuses: Array<'ALL' | BodyPaintStatus> = ['ALL', 'OPEN', 'ASSESSMENT', 'PENDING_APPROVAL', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'IN_REPAIR', 'PAINT', 'QUALITY_CHECK', 'READY_FOR_INVOICE', 'INVOICED', 'READY_FOR_COLLECTION', 'CLOSED', 'CANCELLED']
const label = (s?: string | null) => String(s || '').replace(/_/g, ' ').toLowerCase().replace(/(^| )\w/g, c => c.toUpperCase())
const money = (n?: number | string | null) => n == null || n === '' ? '—' : `Rs. ${Number(n || 0).toLocaleString('en-PK')}`
const primaryInsurance = (order?: RepairOrder) => order?.insuranceCases?.[0]

export default function BodyPaintWorkspace({ token }: { token: string | null }) {
  const [orders, setOrders] = useState<RepairOrder[]>([]), [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<'ALL' | BodyPaintStatus>('ALL'), [insurance, setInsurance] = useState('all'), [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true), [fallback, setFallback] = useState(false), [refresh, setRefresh] = useState(0), [notice, setNotice] = useState('')
  const [surface, setSurface] = useState<'damage' | 'insurance' | 'approval' | 'operation' | 'movement' | 'material' | 'inspection' | null>(null), [newOrder, setNewOrder] = useState(false), [report, setReport] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token) {
      setLoading(false)
      setFallback(false)
      return () => { mounted = false }
    }
    getRepairOrders(token)
      .then(rows => { if (mounted) { setOrders(rows); setFallback(false) } })
      .catch(() => { if (mounted) { setOrders([]); setFallback(false) } })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [token, refresh])

  const filtered = useMemo(() => orders.filter(o => (status === 'ALL' || o.status === status) && (insurance === 'all' || (insurance === 'insured' ? Boolean(primaryInsurance(o)) : !primaryInsurance(o))) && JSON.stringify(o).toLowerCase().includes(query.toLowerCase())), [orders, status, insurance, query])
  const selected = orders.find(o => o.id === selectedId) ?? filtered[0]

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      if (token) await action()
      setNotice(message)
      setSurface(null)
      setRefresh(v => v + 1)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Action could not be completed.')
    }
  }

  const activeRepairs = orders.filter(o => !['CLOSED', 'READY_FOR_COLLECTION', 'CANCELLED'].includes(o.status)).length
  const activeBays = Math.min(10, activeRepairs)
  const capacity = Math.min(100, Math.round((activeBays / 10) * 100))

  return <>
    <section className="page-intro sales-intro">
      <div>
        <p className="eyebrow">BODY &amp; PAINT / REPAIR CONTROL <span className="live-pill"><i /> LIVE</span></p>
        <h1>Body &amp; Paint</h1>
        <p className="subtitle">Move every collision repair from damage assessment to invoice-ready with confidence.</p>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><button className="secondary-button" disabled={!token} onClick={() => token && getBodyPaintWorkloadReport(token).then(setReport).catch(e => setNotice(e.message))}>Body &amp; Paint report</button><button className="primary-button" onClick={() => setNewOrder(true)}>＋ New repair order</button></div>
    </section>

    <div className="service-summary body-summary">
      <div>
        <strong>Collision repair floor</strong>
        <span>{fallback ? 'Demo data · API unavailable' : 'Connected to live body & paint data'}</span>
      </div>
      <div className="service-stats">
        <span><b>{activeRepairs}</b> active repairs</span>
        <span><b>{orders.filter(o => o.status === 'AWAITING_APPROVAL' || o.status === 'PENDING_APPROVAL').length}</b> awaiting approval</span>
        <span><b>{orders.filter(o => primaryInsurance(o)).length}</b> insurance cases</span>
      </div>
    </div>

    {fallback && <div className="demo-banner"><span>⚠</span><span><strong>Demo fallback active.</strong> Showing representative repair orders while the Body &amp; Paint API is unavailable.</span><button onClick={() => setRefresh(v => v + 1)}>↻ Retry connection</button></div>}
    {notice && <div className="success-banner">✓ {notice}<button onClick={() => setNotice('')}>×</button></div>}
    {report && <div className="service-summary" style={{ marginBottom: '14px' }}><span><b>{report.pendingWork}</b> pending work</span><span><b>{money(report.revenue)}</b> posted revenue</span><span><b>{report.laborHours}</b> labor hours</span><button className="text-button" onClick={() => setReport(null)}>Dismiss</button></div>}

    <div className="body-context">
      <div>
        <span>REPAIR ORDERS</span>
        <strong>{orders.length}</strong>
        <small>Across all active stages</small>
      </div>
      <div>
        <span>ESTIMATED VALUE</span>
        <strong>{money(orders.reduce((n, o) => n + (o.estimatedTotal || 0), 0))}</strong>
        <small>Customer + insurer scope</small>
      </div>
      <div>
        <span>WORKSHOP CAPACITY</span>
        <strong>{capacity}%</strong>
        <small>{activeBays} of 10 repair bays active</small>
        <div className="body-progress"><i style={{ width: `${capacity}%` }} /></div>
      </div>
    </div>

    <section className="body-layout panel">
      <div className="body-list">
        <div className="service-toolbar">
          <label className="sales-search">
            ⌕ <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search order, customer, registration…" />
          </label>
          <select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
            {statuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : label(s)}</option>)}
          </select>
          <select value={insurance} onChange={e => setInsurance(e.target.value)}>
            <option value="all">All coverage</option>
            <option value="insured">Insured</option>
            <option value="private">Private</option>
          </select>
        </div>

        {loading ? (
          <div className="sales-state"><span className="spinner" /><strong>Loading repair orders…</strong><span>Connecting to the collision repair desk.</span></div>
        ) : filtered.length === 0 ? (
          <div className="sales-state">▧<strong>No matching repair orders</strong><span>Try another status, coverage or search term.</span><button className="text-button" onClick={() => { setQuery(''); setStatus('ALL'); setInsurance('all') }}>Clear filters</button></div>
        ) : (
          <div className="repair-table">
            <div className="job-head">
              <span>Repair order</span>
              <span>Vehicle / customer</span>
              <span>Coverage</span>
              <span>Status</span>
            </div>
            {filtered.map(o => (
              <button className={`job-row ${selected?.id === o.id ? 'selected' : ''}`} key={o.id} onClick={() => setSelectedId(o.id)}>
                <div><strong>{o.orderNo}</strong><span>Opened {o.openedAt || 'Today'}</span></div>
                <div><strong>{o.vehicle?.modelYear} {o.vehicle?.make} {o.vehicle?.model}</strong><span>{o.customer?.name} · {o.vehicle?.registrationNo}</span></div>
                <span>{primaryInsurance(o)?.insurerName || 'Private repair'}</span>
                <span className={`status-pill ${String(o.status || '').toLowerCase()}`}>{label(o.status)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

       <RepairDetail
        order={selected}
        setSurface={setSurface}
        onStatus={next => selected && run(() => token ? updateRepairOrderStatus(token, selected.id, { status: next }) : Promise.resolve(), `${selected.orderNo} moved to ${label(next)}.`)}
        onInvoiceReady={() => selected && run(async () => { if (!token) return; const invoice = await createBodyPaintInvoice(token, selected.id); if (invoice.status === 'READY') await postBodyPaintInvoice(token, invoice.id) }, `Invoice posted for ${selected.orderNo}.`)}
        onFinalInspection={() => selected && setSurface('inspection')}
        onDeliver={() => selected && run(() => token ? deliverBodyPaintOrder(token, selected.id) : Promise.resolve(), `${selected.orderNo} delivered and closed.`)}
      />
    </section>

    {surface && selected && <BodyActionPanel kind={surface} order={selected} token={token} onClose={() => setSurface(null)} onRun={run} />}
    {newOrder && <NewRepairOrderModal token={token} onClose={() => setNewOrder(false)} onDone={() => { setNewOrder(false); setRefresh(v => v + 1) }} />}
  </>
}

export { BodyPaintWorkspace }

function NewRepairOrderModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: () => void }) {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone?: string; customerCode?: string; branchId?: string }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: string; make?: string; model?: string; registrationNo?: string; customerId?: string | null; branchId?: string }>>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [branchId, setBranchId] = useState('MAIN')
  const [complaint, setComplaint] = useState('')
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
    ]).then(([custs, vehs]) => {
      if (!active) return
      const validCusts = Array.isArray(custs) ? custs : []
      const validVehs = Array.isArray(vehs) ? vehs : []
      setCustomers(validCusts)
      setVehicles(validVehs)
      if (validCusts.length > 0) {
        const first = validCusts[0]
        setSelectedCustomerId(first.id)
        if (first.branchId) setBranchId(first.branchId)
        const match = validVehs.find(v => v.customerId === first.id || !v.customerId)
        if (match) setSelectedVehicleId(match.id)
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
    const nextVehs = vehicles.filter(v => v.customerId === customerId || !v.customerId)
    if (nextVehs.length > 0) {
      if (!nextVehs.some(v => v.id === selectedVehicleId)) {
        setSelectedVehicleId(nextVehs[0].id)
      }
    } else {
      setSelectedVehicleId('')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return setError('Sign in to create a repair order.')
    const custId = manualMode ? manualCustomerId.trim() : selectedCustomerId
    const vehId = manualMode ? manualVehicleId.trim() : selectedVehicleId
    if (!custId) return setError('Please select or specify a customer.')
    if (!vehId) return setError('Please select or specify a vehicle.')

    setBusy(true)
    setError('')
    try {
      await createRepairOrder(token, {
        branchId,
        customerId: custId,
        vehicleId: vehId,
        complaint: complaint.trim() || undefined,
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create repair order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">BODY &amp; PAINT</p>
            <h2>New repair order</h2>
            <p>Start collision repair intake for a customer and vehicle.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={submit}>
          {loading && <p style={{ fontSize: '13px', color: '#64748b' }}>Loading registered customers and vehicles…</p>}

          {!manualMode ? (
            <>
              <label>
                Customer
                <select value={selectedCustomerId} onChange={e => handleCustomerChange(e.target.value)} disabled={loading || customers.length === 0}>
                  {customers.length === 0 && <option value="">No registered customers found</option>}
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customerCode ? `· [${c.customerCode}]` : ''} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Vehicle
                <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)} disabled={loading || matchingVehicles.length === 0}>
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
                <input required value={manualCustomerId} onChange={e => setManualCustomerId(e.target.value)} placeholder="Database Customer ID (e.g. cuid...)" />
              </label>
              <label>
                Vehicle ID
                <input required value={manualVehicleId} onChange={e => setManualVehicleId(e.target.value)} placeholder="Database Vehicle ID (e.g. cuid...)" />
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
            Damage / customer concern <span className="optional">optional</span>
            <textarea rows={3} value={complaint} onChange={e => setComplaint(e.target.value)} placeholder="Observed accident damage, denting/painting requirements…" />
          </label>

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create repair order'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function RepairDetail({ order, setSurface, onStatus, onInvoiceReady, onFinalInspection, onDeliver }: { order?: RepairOrder; setSurface: (s: 'damage' | 'insurance' | 'approval' | 'operation' | 'movement' | 'material' | 'inspection') => void; onStatus: (s: BodyPaintStatus) => void; onInvoiceReady: () => void; onFinalInspection: () => void; onDeliver: () => void }) {
  if (!order) return <aside className="service-detail empty-detail">▧<strong>Select a repair order</strong><span>Choose a collision repair to view its workstream.</span></aside>
  const insurance = primaryInsurance(order)
  return (
    <aside className="service-detail">
      <div className="detail-top">
        <div>
          <p className="eyebrow">REPAIR ORDER</p>
          <h2>{order.orderNo}</h2>
          <span>{order.vehicle?.registrationNo || 'No registration'} · due {order.dueDate || 'scheduled'}</span>
        </div>
        <span className={`status-pill ${String(order.status || '').toLowerCase()}`}>{label(order.status)}</span>
      </div>

      <div className="vehicle-card">
        <div className="record-avatar vehicle">🚙</div>
        <div>
          <strong>{order.vehicle?.modelYear} {order.vehicle?.make} {order.vehicle?.model}</strong>
          <span>{order.customer?.name} · {order.vehicle?.colour} · {order.vehicle?.vin || 'VIN pending'}</span>
        </div>
      </div>

      <div className="insurance-card">
        <div>
          <span>INSURANCE CASE</span>
           <strong>{insurance?.insurerName || 'Private customer repair'}</strong>
        </div>
        <div>
          <span>CLAIM / EXCESS</span>
           <strong>{insurance ? `${insurance.claimNo || 'Claim pending'} · ${money(insurance.deductible)}` : 'Customer funded'}</strong>
        </div>
      </div>

      <div className="detail-assignment">
        <span>Estimated / approved</span>
        <strong>{money(order.estimatedTotal)} <small> / {money(order.approvedTotal)}</small></strong>
        <button onClick={() => setSurface('approval')}>Review</button>
      </div>

      <div className="workstream">
        <span className="context-label">REPAIR WORKSTREAM</span>
        <div className="action-grid">
          <button onClick={() => setSurface('damage')}>◈<strong>Damage assessment</strong><small>Capture damage areas</small></button>
          <button onClick={() => setSurface('insurance')}>▣<strong>Insurance case</strong><small>Policy and claim data</small></button>
          <button onClick={() => setSurface('approval')}>✓<strong>Approvals</strong><small>Customer &amp; insurer</small></button>
          <button onClick={() => setSurface('operation')}>⚒<strong>Body / paint ops</strong><small>Manage repair stages</small></button>
          <button onClick={() => setSurface('movement')}>⇄<strong>Vehicle movement</strong><small>Track bay transfers</small></button>
          <button onClick={() => setSurface('material')}>▦<strong>Materials</strong><small>Record consumption</small></button>
          <button onClick={onFinalInspection}>✓<strong>Final inspection</strong><small>Release for delivery</small></button>
          <button onClick={() => onStatus(order.status === 'IN_REPAIR' ? 'PAINT' : 'IN_REPAIR')}>→<strong>Advance status</strong><small>Move workstream forward</small></button>
        </div>
        <button className="invoice-ready-button" onClick={onInvoiceReady}>▤ Create and post invoice</button>
        <button className="secondary-button" style={{ marginTop: '8px', width: '100%' }} onClick={onDeliver}>Deliver vehicle</button>
      </div>
    </aside>
  )
}

function BodyActionPanel({ kind, order, token, onClose, onRun }: { kind: 'damage' | 'insurance' | 'approval' | 'operation' | 'movement' | 'material' | 'inspection'; order: RepairOrder; token: string | null; onClose: () => void; onRun: (a: () => Promise<unknown>, m: string) => void }) {
  const [value, setValue] = useState(kind === 'damage' ? 'Rear bumper · moderate impact' : kind === 'operation' ? 'Panel alignment' : kind === 'movement' ? 'MAIN' : kind === 'material' ? 'PAINT-RED-01' : '')
  const [party, setParty] = useState<ApprovalParty>('CUSTOMER')
  const [opType, setOpType] = useState<'BODY' | 'PAINT'>('BODY')
  const [hours, setHours] = useState('2')
  const [rate, setRate] = useState('95')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('50')
  const [busy, setBusy] = useState(false)
  const titles = { damage: 'Damage assessment', insurance: 'Insurance case', approval: 'Repair approvals', operation: 'Body & paint operation', movement: 'Vehicle movement', material: 'Material consumption', inspection: 'Final inspection' }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const done = (action: () => Promise<unknown>, msg: string) => onRun(action, msg)

    if (kind === 'insurance') {
      done(() => token ? createInsuranceCase(token, order.id, { insurerName: value || 'Insurance provider', claimNo: 'CLAIM-PENDING', status: 'OPEN', deductible: Number(unitCost) || 0 }) : Promise.resolve(), `Insurance case recorded for ${order.orderNo}.`)
    } else if (kind === 'inspection') {
      done(() => token ? createBodyPaintFinalInspection(token, order.id, { checklist: { panelGaps: true, paintFinish: true, lights: true, cleanliness: true }, passed: value === 'Passed', notes: 'Final Body & Paint inspection' }) : Promise.resolve(), `Final inspection recorded for ${order.orderNo}.`)
    } else if (kind === 'damage') {
      done(() => token ? createDamageAssessment(token, order.id, { area: value.split('·')[0].trim(), severity: 'MODERATE', description: value, photoCount: 0 }) : Promise.resolve(), `Damage assessment added to ${order.orderNo}.`)
    } else if (kind === 'approval') {
      done(() => token ? requestRepairApproval(token, order.id, { party, amount: order.estimatedTotal || 0 }) : Promise.resolve(), `${party === 'CUSTOMER' ? 'Customer' : 'Insurer'} approval requested.`)
    } else if (kind === 'operation') {
      done(() => token ? createBodyPaintOperation(token, order.id, { type: opType, description: value, hours: Number(hours), rate: Number(rate), status: 'IN_PROGRESS' }) : Promise.resolve(), `Operation added to ${order.orderNo}.`)
    } else if (kind === 'movement') {
      done(() => token ? recordVehicleMovement(token, order.id, { from: 'BODYPAINT', to: value }) : Promise.resolve(), `Vehicle movement recorded to ${value}.`)
    } else {
      done(() => token ? recordMaterialConsumption(token, order.id, { partId: value, quantity: Number(quantity), unitCost: Number(unitCost) }) : Promise.resolve(), `Material consumption recorded.`)
    }
    setBusy(false)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal service-action-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{order.orderNo}</p>
            <h2>{titles[kind]}</h2>
            <p>Capture a traceable step without leaving the repair order.</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          {kind === 'insurance' ? (
            <><label>Insurer name<input required value={value} onChange={e => setValue(e.target.value)} /></label><label>Deductible (Rs.)<input min="0" type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} /></label></>
          ) : kind === 'inspection' ? (
            <label>Inspection result<select value={value || 'Passed'} onChange={e => setValue(e.target.value)}><option>Passed</option><option>Failed</option></select></label>
          ) : kind === 'approval' ? (
            <label>
              Approval party
              <select value={party} onChange={e => setParty(e.target.value as ApprovalParty)}>
                <option value="CUSTOMER">Customer approval</option>
                <option value="INSURER">Insurer approval</option>
              </select>
            </label>
          ) : kind === 'operation' ? (
            <>
              <div className="form-row">
                <label>
                  Operation category
                  <select value={opType} onChange={e => setOpType(e.target.value as 'BODY' | 'PAINT')}>
                    <option value="BODY">Body / Panel Denting</option>
                    <option value="PAINT">Paint / Refinishing</option>
                  </select>
                </label>
                <label>
                  Hours
                  <input required min="0.1" step="0.5" type="number" value={hours} onChange={e => setHours(e.target.value)} />
                </label>
                <label>
                  Rate (Rs./hr)
                  <input required min="0" step="1" type="number" value={rate} onChange={e => setRate(e.target.value)} />
                </label>
              </div>
              <label>
                Operation description
                <input required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. Fender dent pulling & primer application" />
              </label>
            </>
          ) : kind === 'material' ? (
            <>
              <label>
                Part / Material ID or Code
                <input required value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. PAINT-RED-01 or Part ID" />
              </label>
              <div className="form-row">
                <label>
                  Quantity
                  <input required min="0.01" step="0.1" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </label>
                <label>
                  Unit Cost (Rs.)
                  <input required min="0" step="0.5" type="number" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                </label>
              </div>
            </>
          ) : (
            <label>
              {kind === 'movement' ? 'Move vehicle to (Location Code/ID)' : 'Details'}
              <input required value={value} onChange={e => setValue(e.target.value)} placeholder={kind === 'damage' ? 'Area and observed damage' : 'Enter location code e.g. MAIN, WORKSHOP'} />
            </label>
          )}

          {kind === 'approval' && (
            <p className="approval-visibility">
              Visible to <strong>{party === 'CUSTOMER' ? 'customer portal' : 'insurer claim file'}</strong> · requested amount {money(order.estimatedTotal)}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}
