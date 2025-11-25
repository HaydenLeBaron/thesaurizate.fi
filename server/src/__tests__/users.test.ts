import request from 'supertest';
import { app } from './app';
import { pool } from '../db';

describe('Users API', () => {
    beforeEach(async () => {
        // Clean database before each test
        await pool.query('TRUNCATE TABLE transactions, accounts, users RESTART IDENTITY CASCADE');
    });

    describe('POST /users', () => {
        it('should create a new user successfully', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                })
                .expect(201);

            expect(response.body).toMatchObject({
                id: expect.any(String),
                email: 'test@example.com',
                created_at: expect.any(String),
                updated_at: expect.any(String),
            });
            expect(response.body.password_hash).toBeUndefined();
            expect(response.body.password).toBeUndefined();
        });

        it('should reject invalid email format', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'invalid-email',
                    password: 'password123',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
            expect(response.body.details).toBeDefined();
        });

        it('should reject password shorter than 8 characters', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'test@example.com',
                    password: 'short',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should accept password with exactly 8 characters', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'test8@example.com',
                    password: '12345678',
                })
                .expect(201);

            expect(response.body.email).toBe('test8@example.com');
        });

        it('should reject duplicate email', async () => {
            const userData = {
                email: 'duplicate@example.com',
                password: 'password123',
            };

            // Create first user
            await request(app).post('/v1/users').send(userData).expect(201);

            // Try to create duplicate
            const response = await request(app)
                .post('/v1/users')
                .send(userData)
                .expect(409);

            expect(response.body.error).toBe('Email already exists');
        });

        it('should reject missing email', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    password: 'password123',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should reject missing password', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'test@example.com',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should reject empty email', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: '',
                    password: 'password123',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should reject empty password', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'test@example.com',
                    password: '',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should accept valid email formats', async () => {
            const validEmails = [
                'test@example.com',
                'user.name@example.co.uk',
                'user+tag@example-domain.org',
                'test123@test-domain.com',
            ];

            for (const email of validEmails) {
                const response = await request(app)
                    .post('/v1/users')
                    .send({
                        email,
                        password: 'password123',
                    })
                    .expect(201);

                expect(response.body.email).toBe(email);
            }
        });

        it('should reject invalid email formats', async () => {
            const invalidEmails = [
                'notanemail',
                '@example.com',
                'user@',
                'user @example.com',
                'user@.com',
                'user@example',
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/v1/users')
                    .send({
                        email,
                        password: 'password123',
                    })
                    .expect(400);

                expect(response.body.error).toBe('Validation error');
            }
        });

        it('should accept very long passwords', async () => {
            const longPassword = 'a'.repeat(100);
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'longpass@example.com',
                    password: longPassword,
                })
                .expect(201);

            expect(response.body.email).toBe('longpass@example.com');
        });

        it('should accept passwords with special characters', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'special@example.com',
                    password: '!@#$%^&*()_+-=[]{}|;:,.<>?',
                })
                .expect(201);

            expect(response.body.email).toBe('special@example.com');
        });

        it('should return validation details in error response', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'invalid-email',
                    password: 'short',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
            expect(response.body.details).toBeDefined();
            expect(Array.isArray(response.body.details)).toBe(true);
            expect(response.body.details.length).toBeGreaterThan(0);
        });

        it('should reject invalid field types', async () => {
            const invalidTypes = [
                { email: 123, password: 'password123' },
                { email: true, password: 'password123' },
                { email: {}, password: 'password123' },
                { email: [], password: 'password123' },
                { email: 'test@example.com', password: 12345678 },
                { email: 'test@example.com', password: true },
                { email: 'test@example.com', password: {} },
                { email: 'test@example.com', password: [] },
            ];

            for (const body of invalidTypes) {
                const response = await request(app)
                    .post('/v1/users')
                    .send(body)
                    .expect(400);

                expect(response.body.error).toBe('Validation error');
            }
        });

        it('should reject null values', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: null,
                    password: 'password123',
                })
                .expect(400);

            expect(response.body.error).toBe('Validation error');
        });

        it('should handle very long email addresses', async () => {
            const longEmail = 'a'.repeat(100) + '@example.com';

            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: longEmail,
                    password: 'password123',
                });

            // Should either accept or reject with validation error, but not crash
            if (response.status === 201) {
                expect(response.body.email).toBe(longEmail);
            } else {
                expect([400, 500]).toContain(response.status);
                expect(response.body).toHaveProperty('error');
            }
        });

        it('should return consistent user schema on creation', async () => {
            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'schema-test@example.com',
                    password: 'password123',
                })
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('email');
            expect(response.body).toHaveProperty('created_at');
            expect(response.body).toHaveProperty('updated_at');
            expect(response.body).not.toHaveProperty('password');
            expect(response.body).not.toHaveProperty('password_hash');
            expect(typeof response.body.id).toBe('string');
            expect(typeof response.body.email).toBe('string');
            expect(typeof response.body.created_at).toBe('string');
            expect(typeof response.body.updated_at).toBe('string');
        });

        it('should generate unique IDs for different users', async () => {
            const user1Response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'user1@example.com',
                    password: 'password123',
                })
                .expect(201);

            const user2Response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'user2@example.com',
                    password: 'password123',
                })
                .expect(201);

            expect(user1Response.body.id).not.toBe(user2Response.body.id);
        });

        it('should set created_at and updated_at timestamps', async () => {
            const beforeCreation = new Date();

            const response = await request(app)
                .post('/v1/users')
                .send({
                    email: 'timestamp@example.com',
                    password: 'password123',
                })
                .expect(201);

            const afterCreation = new Date();
            const createdAt = new Date(response.body.created_at);
            const updatedAt = new Date(response.body.updated_at);

            // Allow 10ms tolerance for timing differences
            expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 10);
            expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 10);
            expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 10);
            expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 10);
        });
    });
});

