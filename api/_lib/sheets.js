const { GoogleAuth } = require('google-auth-library');

let _cachedAuth = null;

async function getAuth() {
  if (_cachedAuth) return _cachedAuth;
  const credsB64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credsB64) return null;
  const creds = JSON.parse(Buffer.from(credsB64, 'base64').toString('utf-8'));
  _cachedAuth = new GoogleAuth({
    credentials: { client_email: creds.client_email, private_key: creds.private_key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return _cachedAuth;
}

async function getToken() {
  const auth = await getAuth();
  if (!auth) return null;
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

const SPREADSHEET_ID = () => process.env.GOOGLE_SPREADSHEET_ID;
const TOPICS_SHEET = 'Топики';
const BANS_SHEET = 'Баны';

// Append a row to any sheet tab
async function appendRow(sheetName, row) {
  const token = await getToken();
  if (!token) return;
  const sid = SPREADSHEET_ID();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}!A:Z:append?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [row] }),
  });
  if (!resp.ok) throw new Error(`Sheets append ${resp.status}: ${await resp.text()}`);
}

// Read all rows from a sheet tab
async function readSheet(sheetName) {
  const token = await getToken();
  if (!token) return [];
  const sid = SPREADSHEET_ID();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}!A:Z`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    // Sheet might not exist yet
    if (resp.status === 400) return [];
    throw new Error(`Sheets read ${resp.status}: ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.values || [];
}

// Update a specific cell
async function updateCell(sheetName, cell, value) {
  const token = await getToken();
  if (!token) return;
  const sid = SPREADSHEET_ID();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sid}/values/${encodeURIComponent(sheetName)}!${cell}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!resp.ok) throw new Error(`Sheets update ${resp.status}: ${await resp.text()}`);
}

// Normalize phone: strip everything except digits
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

// Log a new topic to the Топики sheet
// Columns: A=thread_id | B=created_at | C=type | D=phone | E=name | F=status | G=chat_id | H=visitor_id | I=info_message_id
// status: open | closed (авто/по кнопке, диалог завершён) | banned (посетитель забанен)
async function logTopic(threadId, type, phone, name, visitorId, infoMessageId) {
  const now = new Date().toISOString();
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  await appendRow(TOPICS_SHEET, [
    String(threadId), now, type, normalizePhone(phone), name || '', 'open', chatId,
    visitorId || '', infoMessageId ? String(infoMessageId) : '',
  ]);
}

// Найти строку темы по threadId. Возвращает { rowIndex, status, visitorId, chatId, infoMessageId } или null.
// Используется и «тихим» чек-апом в chat-ai.js (не звать модель для закрытой/забаненной темы),
// и вебхуком кнопок (ban/unban/close), чтобы не сканировать лист дважды с разной логикой.
async function getTopicByThreadId(threadId) {
  const rows = await readSheet(TOPICS_SHEET);
  const id = String(threadId);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === id) {
      return {
        rowIndex: i + 1,
        status: row[5] || 'open',
        chatId: row[6] || process.env.TELEGRAM_CHAT_ID,
        visitorId: row[7] || '',
        infoMessageId: row[8] || '',
      };
    }
  }
  return null;
}

// Проставить статус темы (open | closed | banned) по номеру строки
async function setTopicStatus(rowIndex, status) {
  await updateCell(TOPICS_SHEET, `F${rowIndex}`, status);
}

// --- Баны посетителей (по visitorId — см. ограничение в плане: localStorage, обходится очисткой) ---
// Колонки листа «Баны»: A=visitor_id | B=banned_at | C=banned_by (telegram user id) | D=status (active|lifted) | E=lifted_at
async function isVisitorBanned(visitorId) {
  if (!visitorId) return false;
  const rows = await readSheet(BANS_SHEET);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === visitorId && row[3] === 'active') return true;
  }
  return false;
}

async function banVisitor(visitorId, bannedBy) {
  const now = new Date().toISOString();
  await appendRow(BANS_SHEET, [visitorId, now, String(bannedBy || ''), 'active', '']);
}

// Разбан: если запись активна — гасим её (status=lifted), а не удаляем строку (история бана остаётся).
async function unbanVisitor(visitorId) {
  const rows = await readSheet(BANS_SHEET);
  const now = new Date().toISOString();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === visitorId && row[3] === 'active') {
      await updateCell(BANS_SHEET, `D${i + 1}`, 'lifted');
      await updateCell(BANS_SHEET, `E${i + 1}`, now);
    }
  }
}

// Find an existing open topic by phone number. Returns { threadId, rowIndex } or null
async function findTopicByPhone(phone) {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  const rows = await readSheet(TOPICS_SHEET);
  // Skip header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // row[3]=phone, row[5]=status
    if (normalizePhone(row[3]) === normalized && row[5] === 'open') {
      return { threadId: Number(row[0]), rowIndex: i + 1 }; // 1-based for Sheets
    }
  }
  return null;
}

// Get all open topics with their metadata
async function getOpenTopics() {
  const rows = await readSheet(TOPICS_SHEET);
  const topics = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[5] === 'open') {
      topics.push({
        threadId: Number(row[0]),
        createdAt: row[1],
        type: row[2],
        phone: row[3],
        name: row[4],
        rowIndex: i + 1,
        chatId: row[6] || process.env.TELEGRAM_CHAT_ID,
      });
    }
  }
  return topics;
}

// Mark a topic as closed in the sheet
async function markTopicClosed(rowIndex) {
  await updateCell(TOPICS_SHEET, `F${rowIndex}`, 'closed');
}

module.exports = {
  appendRow,
  readSheet,
  updateCell,
  logTopic,
  findTopicByPhone,
  getOpenTopics,
  markTopicClosed,
  getTopicByThreadId,
  setTopicStatus,
  isVisitorBanned,
  banVisitor,
  unbanVisitor,
  getToken,
  SPREADSHEET_ID,
};
