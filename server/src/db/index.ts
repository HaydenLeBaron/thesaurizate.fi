import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/thesaurum';

// Create postgres connection pool with optimized settings for high concurrency
export const pool = new pg.Pool({
  connectionString,
  max: 100, // Maximum number of clients in the pool
  min: 10, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
