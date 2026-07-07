// Shared Gmail draft-creation logic, used by both telegram-bot.mjs and app-server.mjs.
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

export const GMAIL_ENABLED = Boolean(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);

let gmailAccessToken = null;
let gmailAccessTokenExpiry = 0;

async function getGmailAccessToken() {
  if (gmailAccessToken && Date.now() < gmailAccessTokenExpiry) return gmailAccessToken;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${JSON.stringify(data)}`);
  gmailAccessToken = data.access_token;
  gmailAccessTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return gmailAccessToken;
}

function base64UrlEncode(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createGmailDraft(to, subject, body) {
  const token = await getGmailAccessToken();
  const rawMessage = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: base64UrlEncode(rawMessage) } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail draft creation failed: ${JSON.stringify(data)}`);
  return data.id;
}

// Actually sends (not a draft) — only used for self-reports (to the account owner), never
// for third-party outreach, which must always go through createGmailDraft for manual review.
export async function sendGmail(to, subject, body) {
  const token = await getGmailAccessToken();
  const rawMessage = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", body].join("\r\n");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64UrlEncode(rawMessage) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send failed: ${JSON.stringify(data)}`);
  return data.id;
}

// Sends an operational notification (e.g. a captured enquiry) to a business that already
// owns the underlying data — distinct from third-party cold outreach, so a direct send
// (not a draft) is appropriate here too. Optionally carries one image attachment (e.g. a
// skin photo a visitor uploaded in a chatbot) as a real MIME attachment, not an inline
// data URI, since Gmail's web client doesn't reliably render inline base64 images.
export async function sendGmailWithAttachment(to, subject, textBody, attachment) {
  const token = await getGmailAccessToken();
  const boundary = `----agencyos-${Date.now().toString(36)}`;
  const parts = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    textBody,
  ];
  if (attachment) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      attachment.base64Data
    );
  }
  parts.push(`--${boundary}--`);

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    ...parts,
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64UrlEncode(rawMessage) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gmail send failed: ${JSON.stringify(data)}`);
  return data.id;
}
