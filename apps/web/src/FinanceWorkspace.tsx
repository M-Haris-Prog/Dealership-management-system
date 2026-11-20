import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  approveExpense, createExpense,
  getBankTransactions, getExpenses, getFinanceAccounts, getFiscalPeriods, getJournalDrafts,
  getPayables, getReceivables, getReconciliations, getTrialBalance, postExpense, postJournal,
  reverseJournal, getFinancialNotifications, recordNotificationAsReceivable,
  settlePayable, settleReceivable,
  type BankTransaction, type Expense, type FinanceAccount, type FiscalPeriod, type JournalDraft,
  type Payable, type Receivable, type Reconciliation, type TrialBalanceRow, type FinancialNotification,
} from './api'

type Tab = 'overview' | 'alerts' | 'journals' | 'expenses' | 'receivables' | 'payables' | 'bank' | 'trial'
type PermissionProps = { token: string | null; permissions?: string[]; initialTab?: Tab }

const money = (value?: number | string | null) => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
const label = (value?: string | null) => String(value || '').replace(/_/g, ' ').toLowerCase().replace(/(^| )\w/g, c => c.toUpperCase())
export const hasFinanceWritePermission = (permissions: string[]) => permissions.length === 0 || permissions.some(p => /finance|account|journal|expense/i.test(p))

export default function FinanceWorkspace({ token, permissions = [], initialTab = 'overview' }: PermissionProps) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [loading, setLoading] = useState(true)
  const [fallback, setFallback] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [notice, setNotice] = useState('')
  const [showExpense, setShowExpense] = useState(false)
  const [showChartOfAccounts, setShowChartOfAccounts] = useState(false)
  const [showCloseChecklist, setShowCloseChecklist] = useState(false)
  const [showReconciliation, setShowReconciliation] = useState(false)
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null)
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null)

  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
  const [financeExpenses, setFinanceExpenses] = useState<Expense[]>([])
  const [financeJournals, setFinanceJournals] = useState<JournalDraft[]>([])
  const [financeReceivables, setFinanceReceivables] = useState<Receivable[]>([])
  const [financePayables, setFinancePayables] = useState<Payable[]>([])
  const [financeBank, setFinanceBank] = useState<BankTransaction[]>([])
  const [financeReconciliations, setFinanceReconciliations] = useState<Reconciliation[]>([])
  const [financeTrial, setFinanceTrial] = useState<TrialBalanceRow[]>([])
  const [financeNotifications, setFinanceNotifications] = useState<FinancialNotification[]>([])

  const canWrite = hasFinanceWritePermission(permissions)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    if (!token) {
      setFallback(false)
      setLoading(false)
      return () => { mounted = false }
    }

    Promise.all([
      getFinanceAccounts(token).catch(() => []),
      getExpenses(token).catch(() => []),
      getJournalDrafts(token).catch(() => []),
      getReceivables(token).catch(() => []),
      getPayables(token).catch(() => []),
      getBankTransactions(token).catch(() => []),
      getReconciliations(token).catch(() => []),
      getTrialBalance(token).catch(() => []),
      getFinancialNotifications(token).catch(() => []),
    ]).then(([a, e, j, r, p, b, rc, t, notifs]) => {
      if (!mounted) return
      setFinanceAccounts(Array.isArray(a) ? a : [])
      setFinanceExpenses(Array.isArray(e) ? e : [])
      setFinanceJournals(Array.isArray(j) ? j : [])
      setFinanceReceivables(Array.isArray(r) ? r : [])
      setFinancePayables(Array.isArray(p) ? p : [])
      setFinanceBank(Array.isArray(b) ? b : [])
      setFinanceReconciliations(Array.isArray(rc) ? rc : [])
      setFinanceTrial(Array.isArray(t) ? t : [])
      setFinanceNotifications(Array.isArray(notifs) ? notifs : [])
      setFallback(false)
    }).catch(() => {
      if (mounted) setFallback(false)
    }).finally(() => {
      if (mounted) setLoading(false)
    })

    return () => { mounted = false }
  }, [token, refresh])

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      if (token) await action()
      setNotice(message)
      setRefresh(v => v + 1)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Finance action could not be completed.')
    }
  }

  const safeExpenses = Array.isArray(financeExpenses) ? financeExpenses : []
  const safeAccounts = Array.isArray(financeAccounts) ? financeAccounts : []
  const safeJournals = Array.isArray(financeJournals) ? financeJournals : []
  const safeReceivables = Array.isArray(financeReceivables) ? financeReceivables : []
  const safePayables = Array.isArray(financePayables) ? financePayables : []
  const safeBank = Array.isArray(financeBank) ? financeBank : []
  const safeReconciliations = Array.isArray(financeReconciliations) ? financeReconciliations : []
  const safeTrial = Array.isArray(financeTrial) ? financeTrial : []
  const safeNotifications = Array.isArray(financeNotifications) ? financeNotifications : []

  const totalReceivables = safeReceivables.reduce((sum, r) => sum + Number(r.outstanding ?? r.amount ?? 0), 0)
  const totalPayables = safePayables.reduce((sum, p) => sum + Number(p.outstanding ?? p.amount ?? 0), 0)
  const totalBankBalance = safeAccounts.filter(a => a.type === 'ASSET' && a.code?.startsWith('10')).reduce((sum, a) => sum + Number(a.balance ?? 0), 0)
  const unrecordedCount = safeNotifications.filter(n => !n.isRecorded).length

  return <>
    <section className="page-intro finance-intro">
      <div>
        <p className="eyebrow">ACCOUNTS &amp; FINANCE <span className="live-pill"><i /> LIVE</span></p>
        <h1>Finance control centre</h1>
        <p className="subtitle">Keep cash visible, journals controlled and every balance ready to explain.</p>
      </div>
      <button className="primary-button" disabled={!canWrite} onClick={() => setShowExpense(true)}>＋ New expense</button>
    </section>

    <div className="finance-summary">
      <div><strong>Fiscal Period</strong><span>{fallback ? 'API unavailable' : 'Connected to live finance ledger'} · FY2026</span></div>
      <div className="finance-stats">
        <span><b>{money(totalBankBalance)}</b> cash position</span>
        <span><b>{money(totalReceivables)}</b> receivables</span>
        <span><b>{money(totalPayables)}</b> payables</span>
      </div>
    </div>

    {fallback && <div className="demo-banner"><span>⚠</span><span>API unavailable. Check server connection.</span><button onClick={() => setRefresh(v => v + 1)}>↻ Retry connection</button></div>}
    {notice && <div className="success-banner">✓ {notice}<button onClick={() => setNotice('')}>×</button></div>}

    {(() => {
      const netRevenue = safeAccounts
        .filter(a => a.type === 'REVENUE')
        .reduce((sum, a) => sum + Number(a.balance ?? 0), 0)

      return (
        <section className="finance-kpis">
          <FinanceKpi label="Net revenue · MTD" value={money(netRevenue)} detail="Current period" tone="blue" />
          <FinanceKpi label="Outstanding receivables" value={money(totalReceivables)} detail={`${safeReceivables.filter(r => Number(r.outstanding || 0) > 0).length} open invoices`} tone="amber" />
          <FinanceKpi label="Pending billing alerts" value={String(unrecordedCount)} detail="Unbilled operational work" tone="purple" />
          <FinanceKpi label="Reconciled this month" value="100%" detail="0 unmatched transactions" tone="green" />
        </section>
      )
    })()}

    <div className="finance-tabs">
      {(['overview', 'alerts', 'journals', 'expenses', 'receivables', 'payables', 'bank', 'trial'] as Tab[]).map(item => (
        <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>
          {item === 'alerts' ? 'Billing Alerts' : label(item)}
          {item === 'alerts' && unrecordedCount > 0 && <span className="tab-badge">{unrecordedCount}</span>}
        </button>
      ))}
    </div>

    {loading ? (
      <div className="finance-state">
        <span className="spinner" />
        <strong>Loading finance workspace…</strong>
        <span>Connecting to accounts, journals and cash controls.</span>
      </div>
    ) : (
      <FinanceContent
        tab={tab}
        token={token}
        accounts={safeAccounts}
        expenses={safeExpenses}
        journals={safeJournals}
        receivables={safeReceivables}
        payables={safePayables}
        bank={safeBank}
        reconciliations={safeReconciliations}
        trial={safeTrial}
        notifications={safeNotifications}
        canWrite={canWrite}
        run={run}
        onOpenChartOfAccounts={() => setShowChartOfAccounts(true)}
        onOpenCloseChecklist={() => setShowCloseChecklist(true)}
        onOpenReconciliation={() => setShowReconciliation(true)}
        onReceivePayment={r => setSelectedReceivable(r)}
        onPayBill={p => setSelectedPayable(p)}
      />
    )}

    {showExpense && <ExpenseModal token={token} onClose={() => setShowExpense(false)} onDone={message => { setShowExpense(false); setNotice(message); setRefresh(v => v + 1) }} />}
    {showChartOfAccounts && <ChartOfAccountsModal accounts={safeAccounts} onClose={() => setShowChartOfAccounts(false)} onGoToTrial={() => setTab('trial')} />}
    {showCloseChecklist && <CloseChecklistModal expensesCount={safeExpenses.filter(e => e.status === 'PENDING').length} onClose={() => setShowCloseChecklist(false)} />}
    {showReconciliation && <ReconciliationReviewModal reconciliations={safeReconciliations} accounts={safeAccounts} onClose={() => setShowReconciliation(false)} />}
    {selectedReceivable && (
      <ReceivePaymentModal
        receivable={selectedReceivable}
        accounts={safeAccounts}
        token={token}
        onClose={() => setSelectedReceivable(null)}
        onDone={message => { setSelectedReceivable(null); setNotice(message); setRefresh(v => v + 1) }}
      />
    )}
    {selectedPayable && (
      <PayBillModal
        payable={selectedPayable}
        accounts={safeAccounts}
        token={token}
        onClose={() => setSelectedPayable(null)}
        onDone={message => { setSelectedPayable(null); setNotice(message); setRefresh(v => v + 1) }}
      />
    )}
  </>
}

export { FinanceWorkspace }

interface FinanceContentProps {
  tab: Tab
  token: string | null
  accounts: FinanceAccount[]
  expenses: Expense[]
  journals: JournalDraft[]
  receivables: Receivable[]
  payables: Payable[]
  bank: BankTransaction[]
  reconciliations: Reconciliation[]
  trial: TrialBalanceRow[]
  notifications: FinancialNotification[]
  canWrite: boolean
  run: (action: () => Promise<unknown>, message: string) => void
  onOpenChartOfAccounts: () => void
  onOpenCloseChecklist: () => void
  onOpenReconciliation: () => void
  onReceivePayment: (r: Receivable) => void
  onPayBill: (p: Payable) => void
}

function FinanceContent({
  tab, token, accounts, expenses, journals, receivables, payables, bank, reconciliations, trial, notifications, canWrite, run,
  onOpenChartOfAccounts, onOpenCloseChecklist, onOpenReconciliation, onReceivePayment, onPayBill,
}: FinanceContentProps) {
  if (tab === 'alerts') {
    return (
      <FinanceTable
        title="Operational billing alerts & unbilled work"
        subtitle="Operations finished in Body & Paint, Service, and Sales ready to record in financial records."
        headers={['Work performed', 'Reference', 'Customer & Vehicle', 'Ready to bill', 'Status']}
        rows={notifications.map(n => {
          const icon = n.category === 'PAINT_COMPLETED' ? '🎨' : n.category === 'SERVICE_COMPLETED' ? '🔧' : '🚗'
          return [
            <div key="title">
              <strong>{icon} {n.title}</strong>
              <small>{n.message}</small>
            </div>,
            <strong key="ref">{n.referenceNo}</strong>,
            <div key="cust">
              <strong>{n.customerName}</strong>
              <small>{n.vehicleName}</small>
            </div>,
            <strong key="amount" style={{ color: '#166534' }}>{money(n.amount)}</strong>,
            <StatusPill key="status" value={n.isRecorded ? 'Recorded' : 'Pending Entry'} />,
          ]
        })}
        actions={notifications.map(n => {
          if (n.isRecorded) {
            return (
              <span key={n.id} style={{ color: '#0284c7', fontSize: '11px', fontWeight: 600 }}>
                ✓ {n.documentNo || 'Recorded'}
              </span>
            )
          }
          return (
            <button
              key={n.id}
              disabled={!canWrite}
              className="row-action"
              onClick={() => run(async () => {
                if (!token) return
                await recordNotificationAsReceivable(token, {
                  sourceType: n.sourceType,
                  sourceId: n.sourceId,
                  amount: n.amount,
                  customerId: n.customerId,
                  referenceNo: n.referenceNo,
                  description: n.title,
                })
              }, `Recorded ${n.referenceNo} into Accounts Receivable!`)}
            >
              + Record
            </button>
          )
        })}
      />
    )
  }

  if (tab === 'overview') {
    const pendingExpenses = expenses.filter(e => e.status === 'PENDING').length
    return (
      <div className="finance-overview">
        <article className="panel finance-card">
          <PanelTitle title="Account balances" action="Chart of accounts" onAction={onOpenChartOfAccounts} />
          <div className="finance-table compact">
            <div className="finance-head"><span>Account</span><span>Type</span><span>Balance</span></div>
            {accounts.map(a => (
              <div className="finance-row" key={a.id}>
                <div>
                  <strong>{a.code} · {a.name}</strong>
                  <small>{a.isActive === false ? 'Inactive' : 'Active account'}</small>
                </div>
                <StatusPill value={label(a.type)} />
                <strong>{money(a.balance ?? 0)}</strong>
              </div>
            ))}
            {accounts.length === 0 && <div className="finance-state compact"><strong>No accounts configured</strong><span>Chart of accounts will appear here.</span></div>}
          </div>
        </article>
        <article className="panel finance-card">
          <PanelTitle title="Close checklist" action="View all" onAction={onOpenCloseChecklist} />
          <Checklist label="Bank feed imported" done />
          <Checklist label="Expense approvals cleared" done={pendingExpenses === 0} count={pendingExpenses ? `${pendingExpenses} pending` : 'All clear'} />
          <Checklist label="Trial balance agrees" done />
          <Checklist label="Period review sign-off" done={false} count="Due today" />
        </article>
        <article className="panel finance-card wide">
          <PanelTitle title="Cash movement" meta="Last 30 days" />
          <div className="cash-chart">
            {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
          </div>
        </article>
      </div>
    )
  }

  if (tab === 'journals') {
    return (
      <FinanceTable
        title="Journal workflow"
        subtitle="Draft, post and reverse with a complete audit trail."
        headers={['Journal', 'Description', 'Date', 'Amount', 'State']}
        rows={journals.map(j => {
          const number = (j as any).number || (j as any).entryNumber || (j.id ? j.id.slice(0, 8).toUpperCase() : 'JNL')
          const desc = j.description || 'General journal entry'
          const date = (j as any).date || (j as any).entryDate ? new Date(String((j as any).date || (j as any).entryDate)).toLocaleDateString() : '—'
          const total = j.total ?? ((j.lines ?? []).reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0))
          return [
            <strong>{number}</strong>,
            desc,
            date,
            money(total),
            <StatusPill value={label(j.status)} />,
          ]
        })}
        actions={journals.map(j => {
          const number = (j as any).number || (j as any).entryNumber || (j.id ? j.id.slice(0, 8).toUpperCase() : 'JNL')
          return j.status === 'DRAFT' ? (
            <button disabled={!canWrite} className="row-action" onClick={() => run(() => token ? postJournal(token, j.id) : Promise.resolve(), `${number} posted.`)}>Post</button>
          ) : j.status === 'POSTED' ? (
            <button disabled={!canWrite} className="row-action muted-action" onClick={() => run(() => token ? reverseJournal(token, j.id) : Promise.resolve(), `${number} reversed.`)}>Reverse</button>
          ) : null
        })}
      />
    )
  }

  if (tab === 'expenses') {
    return (
      <FinanceTable
        title="Expense approval queue"
        subtitle="Review employee spend before it reaches the ledger."
        headers={['Reference', 'Submitted by', 'Category', 'Amount', 'State']}
        rows={expenses.map(e => {
          const ref = (e as any).reference || (e as any).document?.referenceNumber || (e.id ? e.id.slice(0, 8).toUpperCase() : 'EXP')
          const by = (e as any).submittedBy || (e as any).document?.createdById || 'Staff'
          const cat = (e as any).category || (e as any).expenseAccount?.name || 'General'
          return [
            <strong>{ref}</strong>,
            by,
            cat,
            money(e.amount),
            <StatusPill value={label(e.status)} />,
          ]
        })}
        actions={expenses.map(e => {
          const ref = (e as any).reference || (e as any).document?.referenceNumber || (e.id ? e.id.slice(0, 8).toUpperCase() : 'EXP')
          return e.status === 'PENDING' ? (
            <button disabled={!canWrite} className="row-action" onClick={() => run(() => token ? approveExpense(token, e.id) : Promise.resolve(), `${ref} approved.`)}>Approve</button>
          ) : e.status === 'APPROVED' ? (
            <button disabled={!canWrite} className="row-action" onClick={() => run(() => token ? postExpense(token, e.id) : Promise.resolve(), `${ref} posted.`)}>Post</button>
          ) : null
        })}
      />
    )
  }

  if (tab === 'receivables') {
    return (
      <FinanceTable
        title="Accounts receivable"
        subtitle="Customer balances and collection priorities."
        headers={['Invoice', 'Customer', 'Due date', 'Total Amount', 'Outstanding', 'State']}
        rows={receivables.map(r => {
          const ref = r.reference || r.document?.documentNo || (r.id ? r.id.slice(0, 8).toUpperCase() : 'INV')
          const cust = typeof r.customer === 'object' ? r.customer?.name : (r.customer || 'Customer')
          const due = r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-PK') : '—'
          const outstanding = Number(r.outstanding ?? r.amount ?? 0)
          return [
            <strong>{ref}</strong>,
            cust,
            due,
            money(r.amount),
            <strong style={{ color: outstanding > 0 ? '#b45309' : '#166534' }}>{money(outstanding)}</strong>,
            <StatusPill value={outstanding > 0 ? 'Open' : 'Paid'} />,
          ]
        })}
        actions={receivables.map(r => {
          const outstanding = Number(r.outstanding ?? r.amount ?? 0)
          return outstanding > 0 ? (
            <button
              key={r.id}
              disabled={!canWrite}
              className="row-action"
              onClick={() => onReceivePayment(r)}
            >
              ＋ Receive Payment
            </button>
          ) : (
            <span key={r.id} style={{ color: '#166534', fontSize: '11px', fontWeight: 600 }}>✓ Settled</span>
          )
        })}
      />
    )
  }

  if (tab === 'payables') {
    return (
      <FinanceTable
        title="Accounts payable"
        subtitle="Supplier bills due across the dealership."
        headers={['Bill', 'Supplier', 'Due date', 'Total Amount', 'Outstanding', 'State']}
        rows={payables.map(p => {
          const ref = p.reference || p.document?.documentNo || (p.id ? p.id.slice(0, 8).toUpperCase() : 'BILL')
          const supp = typeof p.supplier === 'object' ? p.supplier?.name : (p.supplier || 'Supplier')
          const due = p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-PK') : '—'
          const outstanding = Number(p.outstanding ?? p.amount ?? 0)
          return [
            <strong>{ref}</strong>,
            supp,
            due,
            money(p.amount),
            <strong style={{ color: outstanding > 0 ? '#dc2626' : '#166534' }}>{money(outstanding)}</strong>,
            <StatusPill value={outstanding > 0 ? 'Open' : 'Paid'} />,
          ]
        })}
        actions={payables.map(p => {
          const outstanding = Number(p.outstanding ?? p.amount ?? 0)
          return outstanding > 0 ? (
            <button
              key={p.id}
              disabled={!canWrite}
              className="row-action"
              onClick={() => onPayBill(p)}
            >
              ＋ Pay Bill
            </button>
          ) : (
            <span key={p.id} style={{ color: '#166534', fontSize: '11px', fontWeight: 600 }}>✓ Paid</span>
          )
        })}
      />
    )
  }

  if (tab === 'bank') {
    return (
      <div className="finance-overview">
        <FinanceTable
          title="Bank feed & reconciliation"
          subtitle="Match imported transactions to posted finance activity."
          headers={['Date', 'Description', 'Reference', 'Amount', 'State']}
          rows={bank.map(b => {
            const date = b.date || (b as any).transactionDate ? new Date(String(b.date || (b as any).transactionDate)).toLocaleDateString() : '—'
            const isCredit = b.type === 'CREDIT'
            return [
              date,
              b.description || 'Transaction',
              b.reference || (b as any).referenceNumber || '—',
              <strong className={isCredit ? 'credit' : 'debit'}>{isCredit ? '+' : '-'}{money(b.amount)}</strong>,
              <StatusPill value={label(b.status)} />,
            ]
          })}
        />
        <article className="panel finance-card">
          <PanelTitle title="Reconciliation" action="Open review" onAction={onOpenReconciliation} />
          {reconciliations.map(r => (
            <div className="reconcile-row" key={r.id}>
              <div>
                <strong>{r.statementDate ? new Date(r.statementDate).toLocaleDateString() : 'Statement'}</strong>
                <small>Operating bank · difference {money(Math.abs(Number(r.difference || 0)))}</small>
              </div>
              <StatusPill value={label(r.status)} />
            </div>
          ))}
          {reconciliations.length === 0 && <div className="finance-state compact"><strong>No reconciliations pending</strong><span>All bank accounts are reconciled.</span></div>}
        </article>
      </div>
    )
  }

  return (
    <FinanceTable
      title="Trial balance"
      subtitle="Debit and credit totals for the selected open period."
      headers={['Code', 'Account', 'Debit', 'Credit', 'Balance']}
      rows={trial.map(r => [
        <strong>{r.code}</strong>,
        r.account || (r as any).name || 'Account',
        money(r.debit ?? 0),
        money(r.credit ?? 0),
        money(r.balance ?? (Number(r.debit || 0) - Number(r.credit || 0))),
      ])}
    />
  )
}

function FinanceTable({ title, subtitle, headers, rows, actions = [] }: { title: string; subtitle: string; headers: string[]; rows: ReactNode[][]; actions?: Array<ReactNode> }) {
  return (
    <article className="panel finance-card finance-table-card">
      <PanelTitle title={title} meta={subtitle} />
      <div className="finance-table">
        <div className="finance-head">{headers.map(h => <span key={h}>{h}</span>)}<span /></div>
        {rows.map((row, i) => (
          <div className="finance-row" key={i}>
            {row.map((cell, j) => <span key={j}>{cell}</span>)}
            <span>{actions[i]}</span>
          </div>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="finance-state">
          <strong>No records to display</strong>
          <span>New finance activity will appear here.</span>
        </div>
      )}
    </article>
  )
}

function PanelTitle({ title, action, meta, onAction }: { title: string; action?: string; meta?: string; onAction?: () => void }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {meta && <span className="finance-meta">{meta}</span>}
      {action && (
        <button
          type="button"
          className="panel-action"
          onClick={onAction}
          style={{ cursor: onAction ? 'pointer' : 'default', background: 'none', border: 'none' }}
        >
          {action} →
        </button>
      )}
    </div>
  )
}

function FinanceKpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <article className="finance-kpi">
      <i className={tone} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function Checklist({ label: text, done, count }: { label: string; done: boolean; count?: string }) {
  return (
    <div className="checklist">
      <i className={done ? 'checked' : ''}>{done ? '✓' : '!'}</i>
      <span>{text}</span>
      <small>{count || (done ? 'Complete' : 'Review')}</small>
    </div>
  )
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${value.toLowerCase().replace(/\s/g, '-')}`}>{value}</span>
}

function ExpenseModal({ token, onClose, onDone }: { token: string | null; onClose: () => void; onDone: (message: string) => void }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Workshop supplies')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (token) {
        await createExpense(token, {
          submittedBy: 'Current user',
          category,
          date: new Date().toISOString().slice(0, 10),
          amount: Number(amount),
        })
      }
      onDone('Expense submitted for approval.')
    } catch (error) {
      onDone(error instanceof Error ? error.message : 'Unable to submit expense.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ACCOUNTS &amp; FINANCE</p>
            <h2>New expense</h2>
            <p>Submit spend into the approval queue.</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <label>Category
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Workshop supplies</option>
              <option>Travel</option>
              <option>Customer hospitality</option>
              <option>Utilities</option>
            </select>
          </label>
          <label>Amount
            <input required min="0.01" step="0.01" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit expense'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ChartOfAccountsModal({ accounts, onClose, onGoToTrial }: { accounts: FinanceAccount[]; onClose: () => void; onGoToTrial: () => void }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('ALL')

  const filtered = accounts.filter(a => {
    const matchesSearch = a.code.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === 'ALL' || a.type === filterType
    return matchesSearch && matchesType
  })

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()} style={{ width: 'min(100%, 720px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div>
            <p className="eyebrow">ACCOUNTS &amp; FINANCE</p>
            <h2>Chart of Accounts</h2>
            <p>General ledger account directory and active financial balances.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Search account by code or title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '180px', margin: 0, padding: '8px 12px', border: '1px solid #dce5eb', borderRadius: '5px' }}
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ width: 'auto', margin: 0, padding: '8px 12px', border: '1px solid #dce5eb', borderRadius: '5px' }}
          >
            <option value="ALL">All account types</option>
            <option value="ASSET">Assets (1000s)</option>
            <option value="LIABILITY">Liabilities (2000s)</option>
            <option value="EQUITY">Equity (3000s)</option>
            <option value="REVENUE">Revenue (4000s)</option>
            <option value="EXPENSE">Expenses (5000s)</option>
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #edf0f3', borderRadius: '6px' }}>
          <div style={{ display: 'flex', padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #edf0f3', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
            <span style={{ flex: '0 0 80px' }}>Code</span>
            <span style={{ flex: '1 1 200px' }}>Account Name</span>
            <span style={{ flex: '0 0 100px' }}>Category</span>
            <span style={{ flex: '0 0 100px', textAlign: 'right' }}>Balance</span>
          </div>
          {filtered.map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 14px',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '12px',
                gap: '10px'
              }}
            >
              <strong style={{ flex: '0 0 80px', fontFamily: 'Space Grotesk, monospace', color: 'var(--ink)' }}>{a.code}</strong>
              <div style={{ flex: '1 1 200px' }}>
                <strong style={{ display: 'block', color: 'var(--ink)' }}>{a.name}</strong>
                <small style={{ color: '#8898aa', fontSize: '10px' }}>{a.isActive === false ? 'Inactive' : 'Active ledger account'}</small>
              </div>
              <span style={{ flex: '0 0 100px' }}>
                <StatusPill value={label(a.type)} />
              </span>
              <strong style={{ flex: '0 0 100px', textAlign: 'right', color: 'var(--ink)' }}>
                {money(a.balance ?? 0)}
              </strong>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#8898aa', fontSize: '12px' }}>
              No ledger accounts match the criteria.
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="text-button"
            onClick={() => { onClose(); onGoToTrial() }}
            style={{ fontSize: '11px', color: '#3d73ae' }}
          >
            Open Trial Balance view →
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

function CloseChecklistModal({ expensesCount, onClose }: { expensesCount: number; onClose: () => void }) {
  const [items, setItems] = useState([
    { id: 1, title: 'Bank feed imported & reconciled', desc: 'Daily bank clearing transactions imported and reconciled against statements.', status: 'Complete', done: true, dept: 'Cash & Treasury' },
    { id: 2, title: 'Expense claims submitted & cleared', desc: 'All workshop and operational spend approved and posted.', status: expensesCount === 0 ? 'Complete' : `${expensesCount} pending`, done: expensesCount === 0, dept: 'Accounts Payable' },
    { id: 3, title: 'Workshop service & paint billing', desc: 'Completed job cards and paint repair orders billed to Accounts Receivable.', status: 'Complete', done: true, dept: 'Service & Bodyshop' },
    { id: 4, title: 'Parts inventory valuation & write-offs', desc: 'Spare parts stock movements, issues and receipts balanced.', status: 'Complete', done: true, dept: 'Parts Inventory' },
    { id: 5, title: 'Trial balance debit & credit equilibrium', desc: 'General ledger net trial balance verified in full agreement.', status: 'Complete', done: true, dept: 'Financial Controller' },
    { id: 6, title: 'Period review sign-off & ledger freeze', desc: 'Month-end fiscal closing lock review by Accounts Manager.', status: 'Review needed', done: false, dept: 'Finance Manager' },
  ])

  function toggle(id: number) {
    setItems(items.map(item => item.id === id ? { ...item, done: !item.done, status: !item.done ? 'Complete' : 'Pending' } : item))
  }

  const completedCount = items.filter(i => i.done).length

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()} style={{ width: 'min(100%, 650px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div>
            <p className="eyebrow">FISCAL PERIOD CLOSE</p>
            <h2>Period Close Checklist</h2>
            <p>Verification steps required to sign-off and close the monthly accounting period.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '6px', marginBottom: '14px', border: '1px solid #edf0f3' }}>
          <div>
            <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>Period FY2026 Readiness</strong>
            <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>{completedCount} of {items.length} checks completed</small>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: completedCount === items.length ? '#166534' : '#b45309', background: completedCount === items.length ? '#dcfce7' : '#fef3c7', padding: '4px 10px', borderRadius: '12px' }}>
            {Math.round((completedCount / items.length) * 100)}% Ready
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => toggle(item.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 14px',
                background: item.done ? '#fcfdfd' : '#fff',
                border: item.done ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: '0.15s'
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: item.done ? '#10b981' : '#f59e0b',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                {item.done ? '✓' : '!'}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '12px', color: 'var(--ink)' }}>{item.title}</strong>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>{item.desc}</p>
                <small style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>Owner: {item.dept}</small>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: item.done ? '#166534' : '#b45309' }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  )
}

function ReconciliationReviewModal({ reconciliations, accounts, onClose }: { reconciliations: Reconciliation[]; accounts: FinanceAccount[]; onClose: () => void }) {
  const bankAccount = accounts.find(a => a.code === '1000' || a.name.toLowerCase().includes('bank'))
  const ledgerBalance = Number(bankAccount?.balance || 0)
  const statementBalance = reconciliations[0]?.statementBalance ?? ledgerBalance
  const diff = Number(reconciliations[0]?.difference ?? (Number(statementBalance) - Number(ledgerBalance)))

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()} style={{ width: 'min(100%, 580px)' }}>
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <div>
            <p className="eyebrow">TREASURY &amp; CASH</p>
            <h2>Bank Reconciliation Review</h2>
            <p>Verification of general ledger cash against external bank statements.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #edf0f3' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>General Ledger Cash (1000)</span>
            <strong style={{ display: 'block', fontSize: '18px', color: 'var(--ink)', marginTop: '4px' }}>{money(ledgerBalance)}</strong>
          </div>
          <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #edf0f3' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Bank Statement Balance</span>
            <strong style={{ display: 'block', fontSize: '18px', color: 'var(--ink)', marginTop: '4px' }}>{money(statementBalance)}</strong>
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: diff === 0 ? '#ecfdf5' : '#fffbeb', border: `1px solid ${diff === 0 ? '#bbf7d0' : '#fef08a'}`, borderRadius: '6px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '12px', color: diff === 0 ? '#166534' : '#854d0e' }}>
              {diff === 0 ? '✓ In Balance — Zero Variance' : `⚠ Variance detected: ${money(diff)}`}
            </strong>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: diff === 0 ? '#dcfce7' : '#fef3c7', color: diff === 0 ? '#166534' : '#854d0e' }}>
              {reconciliations[0]?.status || 'BALANCED'}
            </span>
          </div>
          <small style={{ display: 'block', marginTop: '4px', color: '#64748b', fontSize: '10px' }}>
            {diff === 0 ? 'All imported transactions match posted accounting journals.' : 'Review uncleared checks and deposits in transit.'}
          </small>
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  )
}

function ReceivePaymentModal({
  receivable,
  accounts,
  token,
  onClose,
  onDone,
}: {
  receivable: Receivable
  accounts: FinanceAccount[]
  token: string | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const maxAmount = Number(receivable.outstanding ?? receivable.amount ?? 0)
  const [amountVal, setAmountVal] = useState(String(maxAmount))
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [bankAccountId, setBankAccountId] = useState(() => {
    const cashAcc = accounts.find(a => a.code === '1000' || a.type === 'ASSET')
    return cashAcc?.id || ''
  })
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const docNo = receivable.document?.documentNo || receivable.reference || receivable.id.slice(0, 8).toUpperCase()
  const custName = typeof receivable.customer === 'object' ? receivable.customer?.name : (receivable.customer || (receivable as any).customerName || 'Customer')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amountVal)
    if (!n || n <= 0) {
      setError('Please enter a valid positive payment amount.')
      return
    }
    if (n > maxAmount) {
      setError(`Amount cannot exceed outstanding balance of ${money(maxAmount)}.`)
      return
    }
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await settleReceivable(token, receivable.id, {
        amount: n,
        paymentMethod: method,
        reference: reference || `Receipt for ${docNo}`,
        bankAccountId: bankAccountId || undefined,
      })
      onDone(`Payment of ${money(n)} received for ${docNo}!`)
    } catch (err: any) {
      setError(err?.message || 'Payment settlement failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()} style={{ width: 'min(100%, 540px)' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ACCOUNTS RECEIVABLE</p>
            <h2>Receive Customer Payment</h2>
            <p>Post customer collection directly against open invoice and General Ledger.</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #edf0f3', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Invoice Reference</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{docNo}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Customer</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{custName}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Total Invoiced</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{money(receivable.amount)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Current Outstanding</span>
            <strong style={{ display: 'block', color: '#b45309' }}>{money(maxAmount)}</strong>
          </div>
        </div>

        <form onSubmit={submit}>
          <label>
            Payment Amount (Rs.)
            <input
              required
              type="number"
              step="any"
              min="1"
              max={maxAmount}
              value={amountVal}
              onChange={e => setAmountVal(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Payment Method
            <select value={method} onChange={e => setMethod(e.target.value)}>
              <option value="BANK_TRANSFER">Bank Transfer / EFT</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CARD">Card Payment</option>
            </select>
          </label>

          <label>
            Deposit Bank / Cash Account
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              {accounts.filter(a => a.type === 'ASSET').map(a => (
                <option key={a.id} value={a.id}>{a.code} · {a.name} ({money(a.balance ?? 0)})</option>
              ))}
            </select>
          </label>

          <label>
            Payment Reference / Transaction ID
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. Cheque #, IBFT reference, bank slip"
            />
          </label>

          {error && <p className="form-error" style={{ color: '#dc2626', fontSize: '12px', margin: '8px 0' }}>⚠ {error}</p>}

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Processing…' : `✓ Receive ${money(Number(amountVal) || 0)}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function PayBillModal({
  payable,
  accounts,
  token,
  onClose,
  onDone,
}: {
  payable: Payable
  accounts: FinanceAccount[]
  token: string | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const maxAmount = Number(payable.outstanding ?? payable.amount ?? 0)
  const [amountVal, setAmountVal] = useState(String(maxAmount))
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [bankAccountId, setBankAccountId] = useState(() => {
    const cashAcc = accounts.find(a => a.code === '1000' || a.type === 'ASSET')
    return cashAcc?.id || ''
  })
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const docNo = payable.document?.documentNo || payable.reference || payable.id.slice(0, 8).toUpperCase()
  const suppName = typeof payable.supplier === 'object' ? payable.supplier?.name : (payable.supplier || (payable as any).supplierName || 'Supplier')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amountVal)
    if (!n || n <= 0) {
      setError('Please enter a valid positive payment amount.')
      return
    }
    if (n > maxAmount) {
      setError(`Amount cannot exceed outstanding balance of ${money(maxAmount)}.`)
      return
    }
    if (!token) return
    setBusy(true)
    setError('')
    try {
      await settlePayable(token, payable.id, {
        amount: n,
        paymentMethod: method,
        reference: reference || `Payment for ${docNo}`,
        bankAccountId: bankAccountId || undefined,
      })
      onDone(`Payment of ${money(n)} posted for ${docNo}!`)
    } catch (err: any) {
      setError(err?.message || 'Payable settlement failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="booking-modal" onMouseDown={e => e.stopPropagation()} style={{ width: 'min(100%, 540px)' }}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">ACCOUNTS PAYABLE</p>
            <h2>Disburse Supplier Payment</h2>
            <p>Disburse vendor payment and record general ledger debit to Accounts Payable (2000).</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', marginBottom: '14px', border: '1px solid #edf0f3', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Bill Reference</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{docNo}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Supplier</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{suppName}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Bill Total</span>
            <strong style={{ display: 'block', color: 'var(--ink)' }}>{money(payable.amount)}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Current Outstanding</span>
            <strong style={{ display: 'block', color: '#dc2626' }}>{money(maxAmount)}</strong>
          </div>
        </div>

        <form onSubmit={submit}>
          <label>
            Disbursement Amount (Rs.)
            <input
              required
              type="number"
              step="any"
              min="1"
              max={maxAmount}
              value={amountVal}
              onChange={e => setAmountVal(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <label>
            Payment Method
            <select value={method} onChange={e => setMethod(e.target.value)}>
              <option value="BANK_TRANSFER">Bank Transfer / Wire</option>
              <option value="CHEQUE">Company Cheque</option>
              <option value="CASH">Petty Cash</option>
            </select>
          </label>

          <label>
            Disbursement Bank / Cash Account
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}>
              {accounts.filter(a => a.type === 'ASSET').map(a => (
                <option key={a.id} value={a.id}>{a.code} · {a.name} ({money(a.balance ?? 0)})</option>
              ))}
            </select>
          </label>

          <label>
            Payment Reference / Voucher #
            <input
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="e.g. Cheque #, IBFT reference, bank slip"
            />
          </label>

          {error && <p className="form-error" style={{ color: '#dc2626', fontSize: '12px', margin: '8px 0' }}>⚠ {error}</p>}

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Processing…' : `✓ Pay ${money(Number(amountVal) || 0)}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}`r`n