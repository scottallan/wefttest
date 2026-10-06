import 'express-session';

declare module 'express-session' {
  interface SessionData {
    accessToken?: string;
    oauthState?: string;
    githubLogin?: string;
  }
}
