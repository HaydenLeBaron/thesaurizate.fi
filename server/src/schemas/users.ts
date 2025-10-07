import { z } from 'zod';
import { UsersWrite, UsersRead } from './pgzod/index';

// User creation request (API input) - based on UsersWrite with API-level validation
export const CreateUserSchema = UsersWrite
  .omit({ id: true, password_hash: true, created_at: true, updated_at: true })
  .extend({
    email: z.string().email().meta({ description: 'User email address' }),
    password: z.string().min(8).meta({ description: 'User password (min 8 characters)' }),
  })
  .meta({ id: 'CreateUser' });

// User response (API output - without sensitive data)
export const UserSchema = UsersRead.omit({ password_hash: true }).meta({ id: 'User' });

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type User = z.infer<typeof UserSchema>;
