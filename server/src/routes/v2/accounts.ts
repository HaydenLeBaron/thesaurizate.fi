import { Router } from 'express';
import { z } from 'zod';
import * as db from 'zapatos/db';
import { pool } from '../../db';
import { getAccountBalance, getAccountBalanceOnDate } from '../../services/transactions';
import {
  AccountListQuerySchema,
  AccountBalanceQuerySchema,
  AccountIdPathSchema,
} from '../../schemas/v2/accounts';

const router = Router();

/**
 * GET /v2/accounts
 * Search and view customer accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const validatedQuery = AccountListQuerySchema.parse(req.query);

    // Query all accounts with pagination
    const accounts = await db.select('accounts', {}, {
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      order: { by: 'created_at', direction: 'DESC' },
    }).run(pool);

    // Transform to V2 response format (camelCase)
    // Zapatos returns timestamps as ISO string literals, not Date objects
    const response = accounts.map(account => ({
      accountId: account.id,
      userId: account.user_id,
      createdAt: String(account.created_at),
      updatedAt: String(account.updated_at),
    }));

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching accounts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}
 * Get account balances, liabilities, and other information
 */
router.get('/accounts/:accountId', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);
    const validatedQuery = AccountBalanceQuerySchema.parse(req.query);

    // Query account from database
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get balance (current or historical)
    let balance: number;
    if (validatedQuery.date) {
      balance = await getAccountBalanceOnDate(validatedParams.accountId, new Date(validatedQuery.date));
    } else {
      balance = await getAccountBalance(validatedParams.accountId);
    }

    // Transform to V2 response format (Plaid-style)
    const response = {
      accountId: account.id,
      balance: {
        available: balance,
        current: balance,
        limit: null, // No limit for now
      },
      liabilities: {
        credit: 0, // TODO/is-this-needed: No credit liability for now
        mortgage: 0, // TODO/is-this-needed: No mortgage liability for now
      },
      metadata: {
        createdAt: String(account.created_at),
        updatedAt: String(account.updated_at),
      },
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching account:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}/contact
 * Get account contact information
 */
router.get('/accounts/:accountId/contact', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);

    // Query account from database with all contact fields
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Build holders array (1-2 holders per account)
    const holders: Array<{
      relationship: 'PRIMARY' | 'SECONDARY';
      first: string;
      middle: string | null;
      last: string;
      suffix: string | null;
      prefix: string | null;
    }> = [];

    // Query primary account holder
    if (account.primary_account_holder_id) {
      const primaryHolder = await db.selectOne('users', { id: account.primary_account_holder_id }).run(pool);
      if (primaryHolder) {
        holders.push({
          relationship: 'PRIMARY',
          first: primaryHolder.name_first || '',
          middle: primaryHolder.name_middle || null,
          last: primaryHolder.name_last || '',
          suffix: primaryHolder.name_suffix || null,
          prefix: primaryHolder.name_prefix || null,
        });
      }
    }

    // Query secondary account holder (if present)
    if (account.secondary_account_holder_id) {
      const secondaryHolder = await db.selectOne('users', { id: account.secondary_account_holder_id }).run(pool);
      if (secondaryHolder) {
        holders.push({
          relationship: 'SECONDARY',
          first: secondaryHolder.name_first || '',
          middle: secondaryHolder.name_middle || null,
          last: secondaryHolder.name_last || '',
          suffix: secondaryHolder.name_suffix || null,
          prefix: secondaryHolder.name_prefix || null,
        });
      }
    }

    // Validate that we have at least one holder
    if (holders.length === 0) {
      return res.status(404).json({ error: 'Account contact information not found' });
    }

    // Build emails array (single email from accounts.contact_email)
    const emails: string[] = [];
    if (account.contact_email) {
      emails.push(account.contact_email);
    } else {
      // Email is required per OpenAPI spec (minItems: 1)
      return res.status(404).json({ error: 'Account contact information incomplete' });
    }

    // Build addresses array (single address from accounts address fields)
    const addresses: Array<{
      type: 'BUSINESS' | 'DELIVERY' | 'HOME' | 'MAILING';
      primary: boolean;
      line1: string;
      line2: string | null;
      line3: string | null;
      city: string;
      region: string | null;
      postalCode: string | null;
      country: string;
    }> = [];

    if (account.address_line1 && account.address_city && account.address_country && account.address_type) {
      addresses.push({
        type: account.address_type as 'BUSINESS' | 'DELIVERY' | 'HOME' | 'MAILING',
        primary: account.address_primary ?? true,
        line1: account.address_line1,
        line2: account.address_line2 || null,
        line3: account.address_line3 || null,
        city: account.address_city,
        region: account.address_region || null,
        postalCode: account.address_postal_code || null,
        country: account.address_country,
      });
    } else {
      // Address is required per OpenAPI spec (minItems: 1)
      return res.status(404).json({ error: 'Account contact information incomplete' });
    }

    // Build telephones array (single telephone from accounts telephone fields)
    const telephones: Array<{
      type: 'BOTH' | 'BUSINESS' | 'CELL' | 'FAX' | 'HOME' | 'PERSONAL';
      country: string;
      number: string;
      network: 'CELLULAR' | 'LANDLINE' | 'PAGER' | 'SATELLITE' | 'VOIP' | null;
      primary: boolean;
    }> = [];

    if (account.telephone_number && account.telephone_country && account.telephone_type) {
      telephones.push({
        type: account.telephone_type as 'BOTH' | 'BUSINESS' | 'CELL' | 'FAX' | 'HOME' | 'PERSONAL',
        country: account.telephone_country,
        number: account.telephone_number,
        network: (account.telephone_network as 'CELLULAR' | 'LANDLINE' | 'PAGER' | 'SATELLITE' | 'VOIP' | null) || null,
        primary: account.telephone_primary ?? true,
      });
    } else {
      // Telephone is required per OpenAPI spec (minItems: 1)
      return res.status(404).json({ error: 'Account contact information incomplete' });
    }

    // Transform to V2 response format (camelCase)
    const response = {
      accountId: account.id,
      holders,
      emails,
      addresses,
      telephones,
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching account contact:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * GET /v2/accounts/{accountId}/payment-networks
 * Get payment networks supported by an account
 */
router.get('/accounts/:accountId/payment-networks', async (req, res) => {
  try {
    const validatedParams = AccountIdPathSchema.parse(req.params);

    // Query account from database
    const account = await db.selectOne('accounts', { id: validatedParams.accountId }).run(pool);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Return supported payment networks (hardcoded for now)
    const response = {
      accountId: account.id,
      paymentNetworks: [
        {
          type: 'ACH' as const,
          enabled: true,
          capabilities: ['credit', 'debit'],
        },
        {
          type: 'WIRE' as const,
          enabled: true,
          capabilities: ['credit', 'debit'],
        },
      ],
    };

    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.issues });
    } else {
      console.error('Error fetching payment networks:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
