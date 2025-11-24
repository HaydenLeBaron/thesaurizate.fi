import ExpressOAuthServer from 'express-oauth-server';
import { oauthModel } from './oauth-model';

/**
 * OAuth 2.0 server using express-oauth-server
 * This replaces the custom OAuth implementation
 */
export const oauthServer = new ExpressOAuthServer({
  model: oauthModel,
  useErrorHandler: false, // Handle errors in routes
  continueMiddleware: false,
});

export default oauthServer;

