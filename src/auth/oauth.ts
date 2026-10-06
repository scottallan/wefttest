import { randomBytes } from 'crypto';
import axios from 'axios';
import { Router } from 'express';
import { Config } from '../config';

const SCOPES = 'repo read:user';

export function createAuthRouter(config: Config): Router {
  const router = Router();

  router.get('/login', (req, res) => {
    const state = randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const authorizeUrl = new URL('/login/oauth/authorize', config.githubOAuthUrl);
    authorizeUrl.searchParams.set('client_id', config.githubClientId);
    authorizeUrl.searchParams.set('redirect_uri', config.callbackUrl);
    authorizeUrl.searchParams.set('scope', SCOPES);
    authorizeUrl.searchParams.set('state', state);

    res.redirect(authorizeUrl.toString());
  });

  router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(String(error))}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/?error=missing_code');
    }

    const expectedState = req.session.oauthState;
    delete req.session.oauthState;
    if (!expectedState || state !== expectedState) {
      return res.redirect('/?error=invalid_state');
    }

    try {
      const tokenRes = await axios.post(
        `${config.githubOAuthUrl}/login/oauth/access_token`,
        {
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
          redirect_uri: config.callbackUrl,
        },
        { headers: { Accept: 'application/json' }, validateStatus: () => true }
      );

      if (tokenRes.status >= 400 || tokenRes.data.error || !tokenRes.data.access_token) {
        return res.redirect(`/?error=${encodeURIComponent(tokenRes.data.error || 'token_exchange_failed')}`);
      }

      const accessToken = tokenRes.data.access_token;
      req.session.regenerate((err) => {
        if (err) {
          return res.redirect('/?error=session_error');
        }
        req.session.accessToken = accessToken;
        res.redirect('/dashboard.html');
      });
    } catch (err) {
      res.redirect('/?error=token_exchange_failed');
    }
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('audit_dashboard_sid');
      res.status(200).json({ loggedOut: true });
    });
  });

  router.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('audit_dashboard_sid');
      res.redirect('/');
    });
  });

  return router;
}
