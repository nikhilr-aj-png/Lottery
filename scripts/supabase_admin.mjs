import 'dotenv/config';
const token = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = 'pkloymdzdjykpsutpyqk';

export async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL query failed (${res.status}): ${txt}`);
  }
  return await res.json();
}

async function main() {
  try {
    const tables = await runSql(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Public tables:', tables);
  } catch (err) {
    console.error('Error:', err);
  }
}

if (process.argv[1]?.endsWith('supabase_admin.mjs')) {
  main();
}
