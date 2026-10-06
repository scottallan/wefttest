function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEFAULT_PORT = 3000;

function resolvePort(rawValue: string | undefined): number {
  if (rawValue === undefined || rawValue === '') {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(
      `Invalid PORT environment variable: ${JSON.stringify(rawValue)}. PORT must be a whole number between 1 and 65535.`
    );
  }

  const port = Number(rawValue);

  if (port <= 0 || port > 65535) {
    throw new Error(
      `Invalid PORT environment variable: ${JSON.stringify(rawValue)}. PORT must be a whole number between 1 and 65535.`
    );
  }

  return port;
}

export interface Config {
  githubClientId: string;
  githubClientSecret: string;
  sessionSecret: string;
  callbackUrl: string;
  githubApiUrl: string;
  githubOAuthUrl: string;
  port: number;
  nodeEnv: string;
}

export function loadConfig(): Config {
  return {
    githubClientId: requireEnv('GITHUB_CLIENT_ID'),
    githubClientSecret: requireEnv('GITHUB_CLIENT_SECRET'),
    sessionSecret: requireEnv('SESSION_SECRET'),
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/callback',
    githubApiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    githubOAuthUrl: process.env.GITHUB_OAUTH_URL || 'https://github.com',
    port: resolvePort(process.env.PORT),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
