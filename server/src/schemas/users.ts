import { z } from 'zod';
import { UsersWrite, UsersRead } from './pgzod/index';

// User creation request (API input) - Use UsersWrite, add email validation, replace password_hash with password
export const CreateUserSchema = UsersWrite
  .omit({ id: true, password_hash: true, created_at: true, updated_at: true, email: true })
  .extend({
    email: UsersWrite.shape.email.email().meta({ description: 'User email address', example: 'user@example.com' }),
    password: z.string().min(8).meta({ description: 'User password (min 8 characters)', example: 'mySecurePass123' }),
  })
  .meta({ id: 'CreateUser' });

// User response (API output) - Use UsersRead, omit password_hash
export const UserSchema = UsersRead
  .omit({ password_hash: true })
  .meta({ id: 'User' });

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type User = z.infer<typeof UserSchema>;
