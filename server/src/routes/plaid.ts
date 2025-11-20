import { Router, Request, Response } from 'express';
import { z } from 'zod';
// FIXME: Re-enable authentication middleware in production
// import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import {
  getAccountsForUser,
  getAccountDetails,
  getAccountTransactions,
  getPaymentNetworks,
  getAccountContact,
} from '../services/plaid';
import {
  AccountIdPathSchema,
  TransactionQuerySchema,
} from '../schemas/plaid';

const router = Router();

// FIXME: Re-enable authentication middleware in production
// All routes require authentication
// router.use(authenticateToken);

/**
 * GET /accounts
 * List all accounts for authenticated user
 */
router.get('/accounts', async (req: Request, res: Response) => {
  try {
    // FIXME: Re-enable authentication check in production
    // if (!req.user) {
    //   res.status(401).json({
    //     error: 'unauthorized',
    //     error_description: 'Authentication required',
    //   });
    //   return;
    // }

    // For now, use a default user ID or get from query param
    const userId = (req.query.userId as string) || 'service-account';
    const accounts = await getAccountsForUser(userId);
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /accounts/:accountId
 * Get detailed account information
 */
router.get('/accounts/:accountId', async (req: Request, res: Response) => {
  try {
    // FIXME: Re-enable authentication checks in production
    // if (!req.user) {
    //   res.status(401).json({
    //     error: 'unauthorized',
    //     error_description: 'Authentication required',
    //   });
    //   return;
    // }

    const validatedParams = AccountIdPathSchema.parse(req.params);

    // FIXME: Re-enable user ownership verification in production
    // Verify user owns this account
    // if (validatedParams.accountId !== req.user.userId) {
    //   res.status(403).json({
    //     error: 'forbidden',
    //     error_description: 'Access denied to this account',
    //   });
    //   return;
    // }

    const account = await getAccountDetails(validatedParams.accountId);
    res.json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Validation error',
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Account not found') {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Account not found',
      });
      return;
    }

    console.error('Error fetching account details:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /accounts/:accountId/transactions
 * Get transaction history for account
 */
router.get('/accounts/:accountId/transactions', async (req: Request, res: Response) => {
  try {
    // FIXME: Re-enable authentication checks in production
    // if (!req.user) {
    //   res.status(401).json({
    //     error: 'unauthorized',
    //     error_description: 'Authentication required',
    //   });
    //   return;
    // }

    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedQuery = TransactionQuerySchema.parse(req.query);

    // FIXME: Re-enable user ownership verification in production
    // Verify user owns this account
    // if (validatedParams.accountId !== req.user.userId) {
    //   res.status(403).json({
    //     error: 'forbidden',
    //     error_description: 'Access denied to this account',
    //   });
    //   return;
    // }

    const transactions = await getAccountTransactions(validatedParams.accountId, {
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      startDate: validatedQuery.startDate,
      endDate: validatedQuery.endDate,
    });

    res.json(transactions);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Validation error',
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Account not found') {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Account not found',
      });
      return;
    }

    console.error('Error fetching transactions:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /accounts/:accountId/payment-networks
 * Get payment network information
 */
router.get('/accounts/:accountId/payment-networks', async (req: Request, res: Response) => {
  try {
    // FIXME: Re-enable authentication checks in production
    // if (!req.user) {
    //   res.status(401).json({
    //     error: 'unauthorized',
    //     error_description: 'Authentication required',
    //   });
    //   return;
    // }

    const validatedParams = AccountIdPathSchema.parse(req.params);

    // FIXME: Re-enable user ownership verification in production
    // Verify user owns this account
    // if (validatedParams.accountId !== req.user.userId) {
    //   res.status(403).json({
    //     error: 'forbidden',
    //     error_description: 'Access denied to this account',
    //   });
    //   return;
    // }

    const paymentNetworks = await getPaymentNetworks(validatedParams.accountId);
    res.json(paymentNetworks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Validation error',
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Account not found') {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Account not found',
      });
      return;
    }

    console.error('Error fetching payment networks:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /accounts/:accountId/contact
 * Get contact information for account
 */
router.get('/accounts/:accountId/contact', async (req: Request, res: Response) => {
  try {
    // FIXME: Re-enable authentication checks in production
    // if (!req.user) {
    //   res.status(401).json({
    //     error: 'unauthorized',
    //     error_description: 'Authentication required',
    //   });
    //   return;
    // }

    const validatedParams = AccountIdPathSchema.parse(req.params);

    // FIXME: Re-enable user ownership verification in production
    // Verify user owns this account
    // if (validatedParams.accountId !== req.user.userId) {
    //   res.status(403).json({
    //     error: 'forbidden',
    //     error_description: 'Access denied to this account',
    //   });
    //   return;
    // }

    const contact = await getAccountContact(validatedParams.accountId);
    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Validation error',
        details: error.issues,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Account not found') {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Account not found',
      });
      return;
    }

    console.error('Error fetching contact:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

export default router;

