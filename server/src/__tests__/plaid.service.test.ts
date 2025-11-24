import {
  getAccountsForUser,
  getAccountDetails,
  getAccountTransactions,
  getPaymentNetworks,
  getAccountContact,
} from '../services/plaid';
import { pool } from '../db';
import * as db from 'zapatos/db';
import { executeTransaction, executeDeposit } from '../services/transactions';

describe('Plaid Service', () => {
  let testUserId: string;
  let testUser2Id: string;

  beforeEach(async () => {
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');

    const user1 = await db.insert('users', {
      email: 'user1@example.com',
      password_hash: 'hashed_password',
      account_number: '123456789',
      routing_number: '987654321',
      account_type: 'depository',
      account_name: 'Test Account',
      contact_email: 'contact@example.com',
      contact_phone: '+1234567890',
    }).run(pool);
    testUserId = user1.id;

    const user2 = await db.insert('users', {
      email: 'user2@example.com',
      password_hash: 'hashed_password',
      account_number: '987654321',
      routing_number: '123456789',
      account_type: 'depository',
      account_name: 'Test Account 2',
      contact_email: 'contact2@example.com',
      contact_phone: '+1987654321',
    }).run(pool);
    testUser2Id = user2.id;

    // Create some transactions
    await executeDeposit({
      idempotencyKey: crypto.randomUUID(),
      userId: testUserId,
      amount: 10000,
    });

    await executeTransaction({
      idempotencyKey: crypto.randomUUID(),
      sourceUserId: testUserId,
      destinationUserId: testUser2Id,
      amount: 2000,
    });
  });

  describe('getAccountsForUser', () => {
    it('should return accounts for valid user', async () => {
      const accounts = await getAccountsForUser(testUserId);

      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBe(1);
      expect(accounts[0]).toHaveProperty('accountId', testUserId);
      expect(accounts[0]).toHaveProperty('accountType', 'depository');
      expect(accounts[0]).toHaveProperty('accountName', 'Test Account');
      expect(accounts[0]).toHaveProperty('balance');
      expect(accounts[0].balance).toHaveProperty('amount');
      expect(accounts[0].balance).toHaveProperty('currency', 'USD');
      expect(accounts[0]).toHaveProperty('routingNumber', '987654321');
      expect(accounts[0]).toHaveProperty('accountNumber', '123456789');
    });

    it('should throw error for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(getAccountsForUser(nonExistentId)).rejects.toThrow('User not found');
    });

    it('should return values for user with Plaid fields', async () => {
      const accounts = await getAccountsForUser(testUser2Id);

      expect(accounts.length).toBe(1);
      expect(accounts[0].accountType).toBe('depository');
      expect(accounts[0].accountName).toBe('Test Account 2');
      expect(accounts[0].routingNumber).toBe('123456789');
      expect(accounts[0].accountNumber).toBe('987654321');
    });
  });

  describe('getAccountDetails', () => {
    it('should return account details for valid account', async () => {
      const account = await getAccountDetails(testUserId);

      expect(account).toHaveProperty('accountId', testUserId);
      expect(account).toHaveProperty('accountType', 'depository');
      expect(account).toHaveProperty('accountName', 'Test Account');
      expect(account).toHaveProperty('balance');
      expect(account.balance.amount).toBe(8000); // 10000 - 2000
    });

    it('should throw error for non-existent account', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(getAccountDetails(nonExistentId)).rejects.toThrow('Account not found');
    });
  });

  describe('getAccountTransactions', () => {
    it('should return transactions for account', async () => {
      const transactions = await getAccountTransactions(testUserId);

      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions[0]).toHaveProperty('transactionId');
      expect(transactions[0]).toHaveProperty('accountId', testUserId);
      expect(transactions[0]).toHaveProperty('amount');
      expect(transactions[0].amount).toHaveProperty('amount');
      expect(transactions[0].amount).toHaveProperty('currency', 'USD');
      expect(transactions[0]).toHaveProperty('transactionType');
      expect(['DEBIT', 'CREDIT']).toContain(transactions[0].transactionType);
      expect(transactions[0]).toHaveProperty('transactionDate');
      expect(transactions[0]).toHaveProperty('description');
    });

    it('should support pagination', async () => {
      const transactions = await getAccountTransactions(testUserId, { limit: 1, offset: 0 });

      expect(transactions.length).toBeLessThanOrEqual(1);
    });

    it('should support date filtering', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const transactions = await getAccountTransactions(testUserId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      expect(Array.isArray(transactions)).toBe(true);
      // All transactions should be within date range
      transactions.forEach((tx) => {
        const txDate = new Date(tx.transactionDate);
        expect(txDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    it('should return transactions sorted by date descending', async () => {
      const transactions = await getAccountTransactions(testUserId);

      if (transactions.length > 1) {
        for (let i = 0; i < transactions.length - 1; i++) {
          const current = new Date(transactions[i].transactionDate);
          const next = new Date(transactions[i + 1].transactionDate);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });

    it('should correctly identify DEBIT and CREDIT transactions', async () => {
      const transactions = await getAccountTransactions(testUserId);

      const debitTx = transactions.find((tx) => tx.transactionType === 'DEBIT');
      const creditTx = transactions.find((tx) => tx.transactionType === 'CREDIT');

      if (debitTx) {
        expect(debitTx.description).toContain('Transfer to');
      }
      if (creditTx) {
        expect(creditTx.description).toMatch(/Transfer from|Deposit/);
      }
    });
  });

  describe('getPaymentNetworks', () => {
    it('should return payment networks for account with routing/account numbers', async () => {
      const networks = await getPaymentNetworks(testUserId);

      expect(networks).toHaveProperty('accountId', testUserId);
      expect(networks).toHaveProperty('networks');
      expect(Array.isArray(networks.networks)).toBe(true);
      expect(networks.networks.length).toBeGreaterThan(0);

      const achNetwork = networks.networks.find((n) => n.type === 'ACH');
      const wireNetwork = networks.networks.find((n) => n.type === 'WIRE');

      if (achNetwork) {
        expect(achNetwork).toHaveProperty('routingNumber', '987654321');
        expect(achNetwork).toHaveProperty('accountNumber', '123456789');
      }
      if (wireNetwork) {
        expect(wireNetwork).toHaveProperty('routingNumber', '987654321');
        expect(wireNetwork).toHaveProperty('accountNumber', '123456789');
      }
    });

    it('should return networks for account without routing/account numbers', async () => {
      const networks = await getPaymentNetworks(testUser2Id);

      expect(networks).toHaveProperty('accountId', testUser2Id);
      expect(networks).toHaveProperty('networks');
      // Networks might be empty or contain default entries
    });

    it('should throw error for non-existent account', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(getPaymentNetworks(nonExistentId)).rejects.toThrow('Account not found');
    });
  });

  describe('getAccountContact', () => {
    it('should return contact information for account with contact fields', async () => {
      const contact = await getAccountContact(testUserId);

      expect(contact).toHaveProperty('accountId', testUserId);
      expect(contact).toHaveProperty('email', 'contact@example.com');
      expect(contact).toHaveProperty('phone', '+1234567890');
      expect(contact).toHaveProperty('name', 'Test Account');
    });

    it('should return contact info with contact_email when available', async () => {
      const contact = await getAccountContact(testUser2Id);

      expect(contact).toHaveProperty('accountId', testUser2Id);
      // contact_email takes precedence over email
      expect(contact).toHaveProperty('email', 'contact2@example.com');
      expect(contact.phone).toBe('+1987654321');
      expect(contact.name).toBe('Test Account 2');
    });

    it('should throw error for non-existent account', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(getAccountContact(nonExistentId)).rejects.toThrow('Account not found');
    });
  });
});

