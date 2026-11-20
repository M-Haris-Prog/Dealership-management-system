import 'reflect-metadata';
import { ReportingController } from './reporting.controller';
import { PERMISSIONS_KEY } from '../auth/auth.constants';

describe('reporting and admin permission boundaries', () => {
  const permission = (method: string) => Reflect.getMetadata(PERMISSIONS_KEY, (ReportingController.prototype as any)[method]);

  it('protects reports, exports, and administration with distinct permissions', () => {
    expect(permission('kpis')).toEqual(['reporting.dashboard.read']);
    expect(permission('summary')).toEqual(['reporting.report.read']);
    expect(permission('profitability')).toEqual(['reporting.report.read']);
    expect(permission('drill')).toEqual(['reporting.report.read']);
    expect(permission('metadata')).toEqual(['reporting.report.read']);
    expect(permission('export')).toEqual(['reporting.export']);
    expect(permission('users')).toEqual(['users.manage']);
    expect(permission('createUser')).toEqual(['users.manage']);
    expect(permission('updateAccess')).toEqual(['users.manage']);
    expect(permission('roles')).toEqual(['users.manage']);
    expect(permission('permissions')).toEqual(['users.manage']);
    expect(permission('departments')).toEqual(['users.manage']);
    expect(permission('createDepartment')).toEqual(['users.manage']);
    expect(permission('audits')).toEqual(['audit.view']);
    expect(permission('approvalRules')).toEqual(['approvals.inbox.read']);
    expect(permission('approvals')).toEqual(['approvals.inbox.read']);
    expect(permission('decide')).toEqual(['approvals.decide']);
  });
});
