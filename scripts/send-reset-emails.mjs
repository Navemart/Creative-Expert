// הרצה: node scripts/send-reset-emails.mjs sk_live_XXXXX https://your-app.vercel.app
// ארגומנט 1: Clerk Secret Key
// ארגומנט 2: כתובת האפליקציה (ה-URL של הלייב)

const SECRET_KEY = process.argv[2];
const APP_URL    = process.argv[3] || 'https://creative-expert.vercel.app';

if (!SECRET_KEY?.startsWith('sk_')) {
  console.error('שגיאה: יש להעביר את ה-Clerk Secret Key כארגומנט ראשון');
  console.error('דוגמה: node scripts/send-reset-emails.mjs sk_live_XXXXX https://your-app.vercel.app');
  process.exit(1);
}

const BASE = 'https://api.clerk.com/v1';
const headers = { Authorization: `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' };

async function getAllUsers() {
  const users = [];
  let offset = 0;
  while (true) {
    const res  = await fetch(`${BASE}/users?limit=100&offset=${offset}`, { headers });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    users.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }
  return users;
}

async function createSignInToken(userId) {
  const res  = await fetch(`${BASE}/sign_in_tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 60 * 60 * 24 * 7 }), // תוקף שבוע
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { error: text }; }
}

async function main() {
  console.log('מושך רשימת משתמשים...');
  const users = await getAllUsers();
  console.log(`נמצאו ${users.length} משתמשים\n`);

  const results = [];

  for (const user of users) {
    const email = user.email_addresses?.[0]?.email_address;
    if (!email) { console.log(`דילוג: אין מייל ל-${user.id}`); continue; }

    const data = await createSignInToken(user.id);
    if (data?.token) {
      const link = `${APP_URL}?__clerk_ticket=${data.token}`;
      results.push({ email, link });
      console.log(`✓ ${email}`);
      console.log(`  קישור: ${link}\n`);
    } else {
      console.error(`✗ שגיאה עבור ${email}:`, JSON.stringify(data));
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n=== סיכום — שלח לכל תלמיד את הקישור האישי שלו ===');
  results.forEach(r => console.log(`${r.email}: ${r.link}`));
}

main().catch(console.error);
