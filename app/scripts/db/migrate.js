const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

async function loadSqlFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  return files.filter((file) => file.endsWith('.sql')).sort();
}

async function run() {
  const pool = getPool();
  const migrationDir = path.resolve(__dirname, '../../database/migrations');

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const files = await loadSqlFiles(migrationDir);
    console.log(`Found ${files.length} migration file(s).`);

    for (const filename of files) {
      const alreadyApplied = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
        [filename],
      );

      if (alreadyApplied.rowCount) {
        console.log(`Skipping ${filename} (already applied).`);
        continue;
      }

      const fullPath = path.join(migrationDir, filename);
      const sql = await fs.readFile(fullPath, 'utf8');

      console.log(`Applying ${filename}...`);
      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await pool.query('COMMIT');
        console.log(`Applied ${filename}.`);
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Database migrations completed successfully.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
