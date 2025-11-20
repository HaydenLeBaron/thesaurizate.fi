import request from 'supertest';
import { app } from './app';
import { pool } from '../db';
import { randomUUID } from 'crypto';

describe('Deposit Balance Flow', () => {
  beforeEach(async () => {
    // Clean database before each test
    await pool.query('TRUNCATE TABLE transactions, users RESTART IDENTITY CASCADE');
  });

  it('should handle complete deposit and transaction flow correctly', async () => {
    // Step 1: Create two distinct users
    const user1Response = await request(app)
      .post('/users')
      .send({
        email: 'user1@example.com',
        password: 'password123',
        account_number: '111111111',
        routing_number: '123456789',
        account_type: 'depository',
        contact_email: 'contact1@example.com',
        contact_phone: '+1111111111',
        account_name: 'User 1 Account',
      })
      .expect(201);

    const user2Response = await request(app)
      .post('/users')
      .send({
        email: 'user2@example.com',
        password: 'password123',
        account_number: '222222222',
        routing_number: '987654321',
        account_type: 'depository',
        contact_email: 'contact2@example.com',
        contact_phone: '+2222222222',
        account_name: 'User 2 Account',
      })
      .expect(201);

    const user1Id = user1Response.body.id;
    const user2Id = user2Response.body.id;

    // Step 2: Get both user IDs via GET /admin/users
    const adminUsersResponse = await request(app)
      .get('/admin/users')
      .expect(200);

    expect(adminUsersResponse.body).toHaveLength(2);
    const userIds = adminUsersResponse.body.map((u: { id: string }) => u.id);
    expect(userIds).toContain(user1Id);
    expect(userIds).toContain(user2Id);

    // Step 3: Deposit 11111 to user1 and 22222 to user2
    await request(app)
      .post(`/users/${user1Id}/deposit`)
      .send({
        idempotency_key: randomUUID(),
        amount: 11111,
      })
      .expect(201);

    await request(app)
      .post(`/users/${user2Id}/deposit`)
      .send({
        idempotency_key: randomUUID(),
        amount: 22222,
      })
      .expect(201);

    // Step 4: Check balances - user1 should have 11111, user2 should have 22222
    const balance1Response = await request(app)
      .get(`/users/${user1Id}/balance`)
      .expect(200);

    const balance2Response = await request(app)
      .get(`/users/${user2Id}/balance`)
      .expect(200);

    expect(balance1Response.body).toMatchObject({
      user_id: user1Id,
      balance: 11111,
    });

    expect(balance2Response.body).toMatchObject({
      user_id: user2Id,
      balance: 22222,
    });

    // Step 5: Create a transaction of 1000 from user1 to user2
    await request(app)
      .post('/transactions')
      .send({
        idempotency_key: randomUUID(),
        source_user_id: user1Id,
        destination_user_id: user2Id,
        amount: 1000,
      })
      .expect(201);

    // Step 6: Check balances again
    // user1 should have 11111 - 1000 = 10111
    // user2 should have 22222 + 1000 = 23222
    const finalBalance1Response = await request(app)
      .get(`/users/${user1Id}/balance`)
      .expect(200);

    const finalBalance2Response = await request(app)
      .get(`/users/${user2Id}/balance`)
      .expect(200);

    expect(finalBalance1Response.body).toMatchObject({
      user_id: user1Id,
      balance: 10111,
    });

    expect(finalBalance2Response.body).toMatchObject({
      user_id: user2Id,
      balance: 23222,
    });
  });
});

