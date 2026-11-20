import assert from 'node:assert/strict'
import { describe, it } from '@jest/globals'
import { jest } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
jest.mock('../src/api', () => new Proxy({}, { get: () => jest.fn() }))
import { AuthProvider } from '../src/auth'
import App, { isLowStock, PartsWorkspace, ServiceWorkspace } from '../src/App'
import BodyPaintWorkspace from '../src/BodyPaintWorkspace'
import CashierWorkspace, { hasCashierPermission } from '../src/CashierWorkspace'
import FinanceWorkspace, { hasFinanceWritePermission } from '../src/FinanceWorkspace'
import { DashboardWorkspace, DataState, ReportingWorkspace } from '../src/Phase8Workspace'

function markup(element: React.ReactElement) {
  return renderToStaticMarkup(element)
}

describe('critical DMS surfaces', () => {
  it('renders the unauthenticated login state and session-check state', () => {
    globalThis.localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage
    assert.match(markup(<AuthProvider><App /></AuthProvider>), /Welcome back/)
    globalThis.localStorage = { getItem: (key: string) => key === 'gateway_access_token' ? 'expired-token' : null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage
    assert.match(markup(<AuthProvider><App /></AuthProvider>), /Checking session/)
  })

  it('keeps permission-sensitive cashier and finance actions hidden from write access', () => {
    assert.equal(hasCashierPermission(['cashier.read'], 'cashier.transaction.create'), true)
    assert.equal(hasCashierPermission(['reports.read'], 'cashier.transaction.create'), false)
    assert.equal(hasFinanceWritePermission(['reporting.report.read']), false)
    assert.equal(hasFinanceWritePermission(['finance.expense.create']), true)
  })

  it('classifies inventory low-stock boundaries correctly', () => {
    assert.equal(isLowStock({ quantity: 10, part: { reorderLevel: 10 } }), true)
    assert.equal(isLowStock({ quantity: 11, part: { reorderLevel: 10 } }), false)
    assert.equal(isLowStock({ quantity: 0, part: null }), true)
  })

  it('renders loading states for inventory, service, body-paint, cashier, and finance', () => {
    assert.match(markup(<PartsWorkspace token="test-token" />), /Loading parts workspace/)
    assert.match(markup(<ServiceWorkspace token="test-token" />), /Loading job cards/)
    assert.match(markup(<BodyPaintWorkspace token="test-token" />), /Loading repair orders/)
    assert.match(markup(<CashierWorkspace token="test-token" permissions={['cashier.read']} />), /Loading cashier workspace/)
    assert.match(markup(<FinanceWorkspace token="test-token" permissions={['finance.read']} />), /Loading finance workspace/)
  })

  it('renders reporting and dashboard loading fallbacks before data resolves', () => {
    assert.match(markup(<DashboardWorkspace token="test-token" permissions={['reporting.dashboard.read']} />), /Loading workspace/)
    assert.match(markup(<ReportingWorkspace token="test-token" permissions={['reporting.report.read']} />), /Loading workspace/)
    assert.match(markup(<DataState loading={false} error="Network unavailable" retry={() => undefined}>content</DataState>), /Couldn’t load this workspace.*Network unavailable/s)
    assert.match(markup(<DataState loading={false} empty retry={() => undefined}>content</DataState>), /No records found/)
  })
})
