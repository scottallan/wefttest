import { RateLimitInfo } from './types';

export class GitHubAuthError extends Error {
  constructor(message = 'GitHub authentication failed or was revoked') {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

export class GitHubRateLimitError extends Error {
  rateLimit: RateLimitInfo;

  constructor(rateLimit: RateLimitInfo, message = 'GitHub API rate limit exceeded') {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.rateLimit = rateLimit;
  }
}
