import { NextFunction, Request, Response } from 'express';

export function requireAuthPage(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.accessToken) {
    res.redirect('/');
    return;
  }
  next();
}

export function requireAuthApi(req: Request, res: Response, next: NextFunction): void {
  if (!req.session || !req.session.accessToken) {
    res.status(401).json({ error: 'unauthenticated', redirect: '/' });
    return;
  }
  next();
}
