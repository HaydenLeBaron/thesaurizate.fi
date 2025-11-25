import { z } from 'zod';
import { AccountsWrite, AccountsRead } from './pgzod/index';

// Account creation request (API input) - Requires user_id
export const CreateAccountSchema = AccountsWrite
  .omit({ id: true, created_at: true, updated_at: true })
  .meta({ id: 'CreateAccount' });

// Account response (API output) - Use AccountsRead
export const AccountSchema = AccountsRead
  .meta({ id: 'Account' });

export type CreateAccount = z.infer<typeof CreateAccountSchema>;
export type Account = z.infer<typeof AccountSchema>;
