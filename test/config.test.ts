import { loadConfig } from '../src/config';

describe('loadConfig PORT resolution', () => {
  const originalPort = process.env.PORT;

  afterEach(() => {
    if (originalPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = originalPort;
    }
  });

  it('defaults to 3000 when PORT is unset', () => {
    delete process.env.PORT;
    expect(loadConfig().port).toBe(3000);
  });

  it('defaults to 3000 when PORT is empty string', () => {
    process.env.PORT = '';
    expect(loadConfig().port).toBe(3000);
  });

  it('uses a valid custom PORT', () => {
    process.env.PORT = '8080';
    expect(loadConfig().port).toBe(8080);
  });

  it('accepts the minimum valid port (1)', () => {
    process.env.PORT = '1';
    expect(loadConfig().port).toBe(1);
  });

  it('accepts the maximum valid port (65535)', () => {
    process.env.PORT = '65535';
    expect(loadConfig().port).toBe(65535);
  });

  it('throws a descriptive error for non-numeric PORT', () => {
    process.env.PORT = 'abc';
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws a descriptive error for PORT=0', () => {
    process.env.PORT = '0';
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws a descriptive error for a negative PORT', () => {
    process.env.PORT = '-5';
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws a descriptive error for an out-of-range PORT', () => {
    process.env.PORT = '70000';
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws a descriptive error for a decimal PORT', () => {
    process.env.PORT = '3000.5';
    expect(() => loadConfig()).toThrow(/PORT/);
  });

  it('throws a descriptive error for a PORT with leading/trailing whitespace around non-numeric content', () => {
    process.env.PORT = ' 80 80 ';
    expect(() => loadConfig()).toThrow(/PORT/);
  });
});
