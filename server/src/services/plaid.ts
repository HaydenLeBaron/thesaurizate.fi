import * as db from 'zapatos/db';
import { pool } from '../db';
import type * as s from 'zapatos/schema';
import { getUserBalance } from './transactions';
import type { Account, PlaidTransaction, PaymentNetwork, Contact } from '../schemas/plaid';

/**
 * Get all accounts for a user
 * Since the system uses 1 user = 1 account, we map the user to an account
 */
export async function getAccountsForUser(userId: string): Promise<Account[]> {
    // Handle service account (client credentials flow)
    if (userId === 'service-account') {
        return [];
    }
    
    const user = await db.selectOne('users', { id: userId }).run(pool);
    if (!user) {
        throw new Error('User not found');
    }

    const balance = await getUserBalance(userId);
    const userWithFields = user as s.users.JSONSelectable & {
        account_number?: string | null;
        routing_number?: string | null;
        account_type?: string | null;
        account_name?: string | null;
    };

    return [
        {
            accountId: user.id,
            accountType: (userWithFields.account_type as any) || 'depository',
            accountName: userWithFields.account_name || null,
            balance: {
                amount: balance,
                currency: 'USD',
            },
            routingNumber: userWithFields.routing_number || null,
            accountNumber: userWithFields.account_number || null,
        },
    ];
}

/**
 * Get detailed account information
 */
export async function getAccountDetails(accountId: string): Promise<Account> {
    // Handle service account (client credentials flow)
    if (accountId === 'service-account') {
        throw new Error('Account not found');
    }
    
    const user = await db.selectOne('users', { id: accountId }).run(pool);
    if (!user) {
        throw new Error('Account not found');
    }

    const balance = await getUserBalance(accountId);
    const userWithFields = user as s.users.JSONSelectable & {
        account_number?: string | null;
        routing_number?: string | null;
        account_type?: string | null;
        account_name?: string | null;
    };

    return {
        accountId: user.id,
        accountType: (userWithFields.account_type as any) || 'depository',
        accountName: userWithFields.account_name || null,
        balance: {
            amount: balance,
            currency: 'USD',
        },
        routingNumber: userWithFields.routing_number || null,
        accountNumber: userWithFields.account_number || null,
    };
}

/**
 * Get transactions for an account
 */
export async function getAccountTransactions(
    accountId: string,
    filters?: {
        limit?: number;
        offset?: number;
        startDate?: string;
        endDate?: string;
    }
): Promise<PlaidTransaction[]> {
    // Handle service account (client credentials flow)
    if (accountId === 'service-account') {
        return [];
    }
    
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    // Build query
    let query = db.sql`
    SELECT * FROM ${'transactions'}
    WHERE ${'destination_user_id'} = ${db.param(accountId)}::uuid
       OR ${'source_user_id'} = ${db.param(accountId)}::uuid
  `;

    // Add date filters if provided
    if (filters?.startDate) {
        query = db.sql`
      ${query}
      AND ${'created_at'} >= ${db.param(new Date(filters.startDate))}::timestamptz
    `;
    }

    if (filters?.endDate) {
        query = db.sql`
      ${query}
      AND ${'created_at'} <= ${db.param(new Date(filters.endDate))}::timestamptz
    `;
    }

    query = db.sql`
    ${query}
    ORDER BY ${'created_at'} DESC
    LIMIT ${db.param(limit)}
    OFFSET ${db.param(offset)}
  `;

    const transactions = await query.run(pool);

    // Transform to Plaid/FDX format
    return transactions.map((tx: s.transactions.JSONSelectable) => {
        const isDebit = tx.source_user_id === accountId;
        const isCredit = tx.destination_user_id === accountId;

        // Handle created_at as Date or string
        const createdAt = typeof tx.created_at === 'string'
            ? new Date(tx.created_at)
            : tx.created_at;

        return {
            transactionId: tx.id,
            accountId: accountId,
            amount: {
                amount: tx.amount,
                currency: 'USD',
            },
            transactionType: isDebit ? ('DEBIT' as const) : ('CREDIT' as const),
            transactionDate: createdAt.toISOString(),
            description: isDebit
                ? `Transfer to ${tx.destination_user_id}`
                : tx.source_user_id
                    ? `Transfer from ${tx.source_user_id}`
                    : 'Deposit',
        };
    });
}

/**
 * Get payment network information for an account
 */
export async function getPaymentNetworks(accountId: string): Promise<PaymentNetwork> {
    // Handle service account (client credentials flow)
    if (accountId === 'service-account') {
        return {
            accountId: 'service-account',
            networks: [],
        };
    }
    
    const user = await db.selectOne('users', { id: accountId }).run(pool);
    if (!user) {
        throw new Error('Account not found');
    }

    const userWithFields = user as s.users.JSONSelectable & {
        account_number?: string | null;
        routing_number?: string | null;
    };

    const networks = [];

    if (userWithFields.routing_number || userWithFields.account_number) {
        networks.push({
            type: 'ACH' as const,
            routingNumber: userWithFields.routing_number || null,
            accountNumber: userWithFields.account_number || null,
        });

        // Also support wire transfers with same info
        networks.push({
            type: 'WIRE' as const,
            routingNumber: userWithFields.routing_number || null,
            accountNumber: userWithFields.account_number || null,
        });
    }

    return {
        accountId: user.id,
        networks,
    };
}

/**
 * Get contact information for an account
 */
export async function getAccountContact(accountId: string): Promise<Contact> {
    // Handle service account (client credentials flow)
    if (accountId === 'service-account') {
        return {
            accountId: 'service-account',
            email: 'service@thesaurum.local',
            phone: null,
            name: 'Service Account',
        };
    }
    
    const user = await db.selectOne('users', { id: accountId }).run(pool);
    if (!user) {
        throw new Error('Account not found');
    }

    const userWithFields = user as s.users.JSONSelectable & {
        contact_email?: string | null;
        contact_phone?: string | null;
        account_name?: string | null;
    };

    return {
        accountId: user.id,
        email: userWithFields.contact_email || user.email,
        phone: userWithFields.contact_phone || null,
        name: userWithFields.account_name || null,
    };
}

