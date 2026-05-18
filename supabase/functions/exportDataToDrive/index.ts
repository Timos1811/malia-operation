import * as XLSX from 'https://esm.sh/xlsx@0.18.5';
import { authenticate, errorResponse, handleOptions, jsonResponse, requireAdmin, serviceClient } from '../_shared/auth.ts';

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '{}');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;

  const pemKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const keyData = pemKey.replace('-----BEGIN PRIVATE KEY-----', '').replace('-----END PRIVATE KEY-----', '').replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  const opts = handleOptions(req);
  if (opts) return opts;

  try {
    const user = await authenticate(req);
    requireAdmin(user);

    const supabase = serviceClient();

    const [income, expenses, pendingSales, tasks, caspars, moneyLocations] = await Promise.all([
      supabase.from('table_data').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }).limit(2000),
      supabase.from('pending_sales').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('caspar_fillings').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('money_locations').select('*'),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(income.data || []), 'הכנסות');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses.data || []), 'הוצאות');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendingSales.data || []), 'מכירות בהמתנה');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tasks.data || []), 'משימות');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(caspars.data || []), 'כספרים');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(moneyLocations.data || []), 'מיקומי כסף');

    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const date = new Date().toISOString().split('T')[0];
    const fileName = `malia-export-${date}.xlsx`;

    const accessToken = await getGoogleAccessToken();
    const driveFolderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID') || '';

    const metadata = JSON.stringify({
      name: fileName,
      parents: driveFolderId ? [driveFolderId] : [],
    });

    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file', blob);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );

    const uploadData = await uploadRes.json();
    return jsonResponse({ success: true, fileId: uploadData.id, fileName });
  } catch (err) {
    return errorResponse(err);
  }
});
