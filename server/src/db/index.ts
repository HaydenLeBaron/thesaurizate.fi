import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/thesaurum';

// Create postgres connection pool
export const pool = new pg.Pool({ connectionString });

pool.on('error', err => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
