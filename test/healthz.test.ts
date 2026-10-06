import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

describe('GET /healthz', () => {
  const app = createApp(loadConfig());

  it('returns 200 and status ok with no auth', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not require a session cookie', async () => {
    const res = await request(app).get('/healthz').unset('Cookie');
    expect(res.status).toBe(200);
  });
});
