const fs = require('fs');
const path = require('path');

// Basic manual parser for .env files since dotenv might not be installed
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.substring(0, idx).trim();
    const value = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '.env'));

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY length:", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0);

const url = `${process.env.SUPABASE_URL}/rest/v1/projects?select=id&limit=1`;
const headers = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

console.log("Fetching from:", url);
fetch(url, { headers })
  .then(res => {
    console.log("Status:", res.status);
    return res.text();
  })
  .then(text => {
    console.log("Body:", text);
  })
  .catch(err => {
    console.error("Error:", err);
  });
