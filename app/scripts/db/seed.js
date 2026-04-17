const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run seeds.');
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

async function run() {
  const pool = getPool();
  const seedDir = path.resolve(__dirname, '../../database/seeds');

  try {
    const files = (await fs.readdir(seedDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} seed file(s).`);
    for (const filename of files) {
      const fullPath = path.join(seedDir, filename);
      const sql = await fs.readFile(fullPath, 'utf8');
      console.log(`Applying seed ${filename}...`);
      await pool.query(sql);
    }

    console.log('Database seed completed successfully.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
