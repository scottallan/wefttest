import session from 'express-session';
import { Config } from '../config';

export function createSessionMiddleware(config: Config) {
  return session({
    name: 'audit_dashboard_sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  });
}
