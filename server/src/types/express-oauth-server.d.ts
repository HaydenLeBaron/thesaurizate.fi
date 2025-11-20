declare module 'express-oauth-server' {
  import { Request, Response, NextFunction } from 'express';

  interface OAuthServerOptions {
    model: any;
    grants?: string[];
    accessTokenLifetime?: number;
    allowBearerTokensInQueryString?: boolean;
    useErrorHandler?: boolean;
    continueMiddleware?: boolean;
  }

  class OAuthServer {
    constructor(options: OAuthServerOptions);
    token(): (req: Request, res: Response, next: NextFunction) => void;
    authorize(): (req: Request, res: Response, next: NextFunction) => void;
    authenticate(): (req: Request, res: Response, next: NextFunction) => void;
  }

  export default OAuthServer;
}

