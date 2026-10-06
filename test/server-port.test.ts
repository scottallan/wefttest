import http from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

describe('server listens on configured PORT', () => {
  const originalPort = process.env.PORT;
  let server: http.Server | undefined;

  afterEach((done) => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
    if (server) {
      server.close(() => done());
      server = undefined;
    } else {
      done();
    }
  });

  it('binds to the port resolved from PORT and serves /healthz there', async () => {
    process.env.PORT = '8080';

    const config = loadConfig();
    expect(config.port).toBe(8080);

    const app = createApp(config);
    server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(config.port, () => resolve(s));
    });

    const address = server.address() as AddressInfo;
    expect(address.port).toBe(8080);

    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${address.port}/healthz`, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        })
        .on('error', reject);
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
  });
});
