import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the API as healthy', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok', service: 'gateway-motors-api' });
  });
});
