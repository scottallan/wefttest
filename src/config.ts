function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
