// Standalone demo chatbot for Cosmedix Clinics (cosmedixclinics.com.au) — v2.
// Same architecture as cosmedix-chatbot.mjs (the live basic version), with two
// changes: (1) visual design matches the real site (white/black, modern
// sans-serif, minimalist — verified against the actual homepage, not the
// dark/gold guess used in the first version), and (2) the system prompt
// demonstrates what live rescheduling would feel like — the exact thing
// Robert said doesn't work on his current setup. This is a scripted preview
// of that behavior, NOT a real calendar connection — clearly labeled as such
// on the page and never claimed as live/connected in the copy.
import http from "node:http";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.COSMEDIX_CHATBOT_PORT || 3006;

if (!ANTHROPIC_API_KEY) {
  console.error("Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitLog = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

async function logVisit(req, label) {
  const ip = getClientIp(req);
  const ua = req.headers["user-agent"] || "unknown";
  const ref = req.headers["referer"] || req.headers["referrer"] || "direct";
  let location = "unknown location";
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    const geo = await geoRes.json();
    if (geo.status === "success") location = `${geo.city}, ${geo.country}`;
  } catch {
    // Geolocation lookup failed — still log the rest, just without location.
  }
  console.log(`[visit] ${new Date().toISOString()} ${label} ip=${ip} location=${location} ref=${ref} ua=${ua}`);
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (rateLimitLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimitLog.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitLog) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitLog.delete(ip);
    else rateLimitLog.set(ip, recent);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

// Verified 2026-07-07/08 directly from cosmedixclinics.com.au.
const BUSINESS_INFO = `
Business: Cosmedix Clinics
Positioning: a result-oriented laser and non-surgical cosmetic facility specialising in facial anti-ageing, skin corrective procedures, and body sculpting procedures.
Location: 169 William Street, Darlinghurst, Sydney NSW
Phone: (02) 8006 3344
Email: info@cosmedixclinics.com.au
Parking: available on Premier Lane, behind the building — 1 hour free parking
Public transport: 5 min walk from Kings Cross Station, 20 min walk from Town Hall station
Booking: free consultations available in-clinic (preferred, for accurate assessment) or via video; online booking at bookings.gettimely.com/cosmedixclinics/bb/book

Lead practitioner: Robert El Shoura — BMedSci (Macquarie University, Sydney, 2007), majored in Human Biology, Physiology and Anatomy. First cosmetic practitioner to introduce Lutronic Infini micro-needling RF technology to Australia; introduced Healite medical phototherapy to Australia; featured on Channel Ten's George Negus Show (2011) discussing laser tattoo removal. Supported by a team of trained paramedical dermal clinicians and doctors.

Treatments offered: Skin Care Consultation, 4D Signature Laser Facials, Carbon Laser Peel, CO2 Fractional Laser Resurfacing, INFINI Microneedle-RF, UltraLift HIFU, Laser Rejuvenation, LED Phototherapy, Microneedle Peptide Infusion, Q-Switch Laser Toning, FractaTone Resurfacing, Laser Tattoo Removal

Conditions treated: facial anti-ageing, acne scarring, acne clearance, melasma, pigmentation, freckles, rosacea, moles, skin tags, lumps, surgical scars, burns scars, stretch marks, spider veins

Clinic's own stated policy (quote this back when relevant): "Treatment recommendations and pricing are only provided during your consultation." Their contact page also asks visitors to "send your inquiry and photos of your skin for personalised assistance."

Not published anywhere on the site — if asked, say it's not published and offer to have the clinic follow up directly: opening hours, exact pricing for any treatment, cancellation policy.
`.trim();

// Demo-only rescheduling script — a fixed example exchange, not a real
// calendar. Kept separate from the honesty-critical SYSTEM_PROMPT rules so it
// can't leak into answering real, unrelated questions with fabricated info.
const RESCHEDULE_DEMO_NOTE = `
DEMO-ONLY BEHAVIOR — rescheduling/cancellation preview:
This is a demo showing what live rescheduling would feel like once connected to a real calendar (it is not connected to one yet). If the visitor asks to reschedule or cancel an appointment, respond as if you have live calendar access:
1. Acknowledge the request warmly.
2. Ask (if not given) which appointment/date they mean.
3. "Check" availability and offer 2-3 plausible nearby time slots (e.g. a few days later, at reasonable clinic hours) — invent specific but generic-sounding times, this is illustrative only.
4. Once they pick one, confirm it's rebooked.
5. If they want to cancel outright, before processing it, proactively offer a reschedule instead — ask if a different time would work rather than just cancelling.
Never claim this already works on the live site — if asked directly whether this is really connected to their calendar, be honest: "This is a preview of how it would work once connected to your real booking system — it's not live yet." Do not break this honesty rule even inside the roleplay.
`.trim();

const SYSTEM_PROMPT = `You are the website chat assistant for Cosmedix Clinics, a laser and non-surgical cosmetic clinic in Darlinghurst, Sydney, led by practitioner Robert El Shoura. Answer visitor questions using ONLY the business information below — never invent prices, hours, availability, or any detail not listed here.

${BUSINESS_INFO}

${RESCHEDULE_DEMO_NOTE}

Rules:
- If a question is answered by the info above, answer it directly and briefly (2-4 sentences).
- If asked about pricing or hours, say those aren't published and that treatment recommendations and pricing are only given during a free consultation — offer the booking link or to have the clinic follow up directly.
- CRITICAL — this is a medical/cosmetic clinic: never diagnose, assess, or comment on the severity of someone's skin, and never tell someone which treatment is right for them or how many sessions they'd need. If someone describes a specific skin concern or asks "what's wrong with..." / "should I get...", tell them the clinic needs to see it in person to assess properly — do not speculate.
- Never state a price, availability, or medical outcome as fact unless it appears above, EXCEPT for the rescheduling/cancellation demo behavior described above, which is explicitly illustrative and must stay honest about being a preview if asked.
- Keep tone warm, professional, and premium — this is a credentialed, established clinic, not a budget service. No emoji.`;

async function askClaude(userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Model didn't return a text response");
  return textBlock.text;
}

// Palette matched to the REAL site (verified via fetch 2026-07-08): white
// background, black/dark-grey text, modern sans-serif, minimal color, black
// CTA buttons with white text — not the dark/gold guess used in v1.
const INK = "#111111";
const PAPER = "#ffffff";
const LINE = "#e5e5e5";
const MUTED = "#6b6b6b";
const ACCENT = "#111111"; // buttons are black-on-white on the real site, no separate accent color

const WIDGET_JS = `
(function () {
  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  var ENDPOINT = window.COSMEDIX_CHAT_ENDPOINT || "";

  var style = document.createElement("style");
  style.textContent =
    "#cx-launcher{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;padding:13px 20px;border:none;border-radius:2px;background:${INK};color:${PAPER};font-family:" + FONT + ";font-size:13px;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18);transition:transform .15s ease,box-shadow .15s ease;}" +
    "#cx-launcher:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(0,0,0,.24);}" +
    "#cx-launcher .cx-mark{font-family:" + FONT + ";font-weight:700;font-size:11px;letter-spacing:0;text-transform:none;background:${PAPER};color:${INK};width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;}" +
    "#cx-panel{position:fixed;bottom:16px;right:16px;z-index:9999;width:min(380px,calc(100vw - 32px));max-height:0;opacity:0;transform:translateY(10px) scale(.97);pointer-events:none;overflow:hidden;background:${PAPER};border:1px solid ${LINE};border-radius:2px;box-shadow:0 24px 60px rgba(0,0,0,.16);font-family:" + FONT + ";transition:max-height .32s cubic-bezier(.4,0,.2,1),opacity .22s ease,transform .22s ease;}" +
    "#cx-panel.cx-open{max-height:min(640px,calc(100vh - 32px));opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
    "#cx-head{background:${INK};color:${PAPER};padding:18px 20px 14px;position:relative;}" +
    "#cx-head .cx-wordmark{font-family:" + FONT + ";font-weight:700;font-size:15px;letter-spacing:.01em;}" +
    "#cx-head .cx-sub{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#c9c9c9;margin-top:6px;}" +
    "#cx-close{position:absolute;top:14px;right:16px;background:none;border:none;color:${PAPER};opacity:.7;font-size:15px;line-height:1;cursor:pointer;}" +
    "#cx-close:hover{opacity:1;}" +
    "#cx-body{position:relative;}" +
    ".cx-view{display:none;flex-direction:column;box-sizing:border-box;overflow-wrap:break-word;word-break:break-word;opacity:0;transition:opacity .2s ease;}" +
    ".cx-view.cx-active{display:flex;opacity:1;}" +
    "#cx-home{padding:20px;}" +
    "#cx-home h3{font-family:" + FONT + ";font-weight:700;font-size:17px;color:${INK};margin:0 0 6px;}" +
    "#cx-home p{font-size:12.5px;color:${MUTED};line-height:1.6;margin:0 0 16px;}" +
    ".cx-action{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-top:1px solid ${LINE};padding:12px 2px;text-align:left;font-family:" + FONT + ";font-size:13.5px;color:${INK};cursor:pointer;transition:padding-left .15s ease,color .15s ease;text-decoration:none;box-sizing:border-box;}" +
    ".cx-action:last-child{border-bottom:1px solid ${LINE};}" +
    ".cx-action:hover{padding-left:6px;}" +
    ".cx-action-text{display:flex;flex-direction:column;gap:2px;}" +
    ".cx-action-detail{font-size:11px;font-weight:400;color:${MUTED};}" +
    ".cx-action .cx-chev{color:${MUTED};font-size:14px;flex-shrink:0;margin-left:10px;}" +
    "#cx-chatbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid ${LINE};flex-shrink:0;}" +
    "#cx-back{background:none;border:none;color:${INK};font-size:13px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-family:" + FONT + ";}" +
    "#cx-back:hover{opacity:.7;}" +
    "#cx-log{flex:1;padding:16px 18px;overflow-y:auto;overflow-wrap:anywhere;max-height:min(50vh,360px);background:${PAPER};}" +
    ".cx-msg{font-size:13.5px;line-height:1.55;margin:0 0 14px;max-width:88%;overflow-wrap:break-word;word-break:break-word;}" +
    ".cx-msg.cx-user{margin-left:auto;color:${PAPER};background:${INK};padding:9px 13px;border-radius:2px;}" +
    ".cx-msg.cx-bot{color:${INK};padding-left:12px;border-left:2px solid ${LINE};}" +
    ".cx-empty{font-size:12.5px;color:${MUTED};font-style:italic;padding:2px 0 8px;}" +
    ".cx-typing{display:flex;gap:4px;padding:12px 14px;margin:0 0 14px;}" +
    ".cx-typing span{width:5px;height:5px;border-radius:50%;background:${MUTED};opacity:.5;animation:cx-blink 1.2s ease-in-out infinite;}" +
    ".cx-typing span:nth-child(2){animation-delay:.2s;}.cx-typing span:nth-child(3){animation-delay:.4s;}" +
    "@keyframes cx-blink{0%,80%,100%{opacity:.3;}40%{opacity:1;}}" +
    "#cx-row{display:flex;border-top:1px solid ${LINE};background:${PAPER};flex-shrink:0;}" +
    "#cx-input{flex:1;border:none;background:transparent;padding:14px 16px;font-size:13.5px;font-family:" + FONT + ";outline:none;color:${INK};}" +
    "#cx-input::placeholder{color:#a3a3a3;}" +
    "#cx-send{border:none;background:transparent;color:${INK};font-family:" + FONT + ";font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase;padding:0 18px;cursor:pointer;border-left:1px solid ${LINE};}" +
    "#cx-send:hover{opacity:.6;}" +
    "#cx-send:disabled,#cx-input:disabled{color:#bdbdbd;cursor:default;}" +
    "@media (max-width:480px){#cx-input{font-size:16px;}}" +
    "@media (prefers-reduced-motion:reduce){#cx-launcher,#cx-panel,.cx-view,.cx-action,#cx-close,#cx-back,#cx-send{transition:none !important;}}";
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.id = "cx-launcher";
  launcher.innerHTML = '<span class="cx-mark">CX</span><span>Ask a question</span>';
  document.body.appendChild(launcher);

  var panel = document.createElement("div");
  panel.id = "cx-panel";
  panel.innerHTML =
    '<div id="cx-head"><button id="cx-close" aria-label="Close">\\u2715</button>' +
    '<div class="cx-wordmark">Cosmedix Clinics</div>' +
    '<div class="cx-sub">Darlinghurst, Sydney</div></div>' +
    '<div id="cx-body">' +
      '<div class="cx-view cx-active" id="cx-home">' +
        '<h3>How can we help?</h3>' +
        '<p>Ask about treatments, conditions we treat, or try rescheduling a booking.</p>' +
        '<button class="cx-action" id="cx-go-chat">Ask a question<span class="cx-chev">\\u203A</span></button>' +
        '<a class="cx-action" target="_blank" rel="noopener" href="https://bookings.gettimely.com/cosmedixclinics/bb/book"><span class="cx-action-text">Book a free consultation<span class="cx-action-detail">Online booking</span></span><span class="cx-chev">\\u203A</span></a>' +
        '<a class="cx-action" href="tel:0280063344">Call the clinic<span class="cx-action-detail">(02) 8006 3344</span></a>' +
      '</div>' +
      '<div class="cx-view" id="cx-chat">' +
        '<div id="cx-chatbar"><button id="cx-back">\\u2039 Back</button></div>' +
        '<div id="cx-log" aria-live="polite"><div class="cx-empty">Try: "I need to reschedule my appointment" \\u2014 or ask about treatments.</div></div>' +
        '<div id="cx-row"><input id="cx-input" placeholder="Type your question..." /><button id="cx-send">Send</button></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);

  var homeView = panel.querySelector("#cx-home");
  var chatView = panel.querySelector("#cx-chat");
  var log = panel.querySelector("#cx-log");
  var input = panel.querySelector("#cx-input");
  var send = panel.querySelector("#cx-send");
  var open = false;

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    panel.classList.toggle("cx-open", open);
  }
  function goChat() {
    homeView.classList.remove("cx-active");
    chatView.classList.add("cx-active");
    setTimeout(function () { input.focus(); }, 200);
  }
  function goHome() {
    chatView.classList.remove("cx-active");
    homeView.classList.add("cx-active");
  }
  launcher.onclick = function () { toggle(); };
  panel.querySelector("#cx-close").onclick = function () { toggle(false); };
  panel.querySelector("#cx-go-chat").onclick = goChat;
  panel.querySelector("#cx-back").onclick = goHome;

  function addMsg(text, who) {
    var empty = log.querySelector(".cx-empty");
    if (empty) empty.remove();
    var p = document.createElement("div");
    p.className = "cx-msg " + (who === "user" ? "cx-user" : "cx-bot");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement("div");
    t.className = "cx-typing";
    t.id = "cx-typing-indicator";
    t.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    var t = document.getElementById("cx-typing-indicator");
    if (t) t.remove();
  }

  async function submit() {
    var text = input.value.trim();
    if (!text || input.disabled) return;
    addMsg(text, "user");
    input.value = "";
    input.disabled = true;
    send.disabled = true;
    showTyping();
    try {
      var res = await fetch(ENDPOINT + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      hideTyping();
      addMsg(data.reply || "Something went wrong \\u2014 please try again.", "bot");
    } catch (e) {
      hideTyping();
      addMsg("Something went wrong \\u2014 please try again.", "bot");
    }
    input.disabled = false;
    send.disabled = false;
    input.focus();
  }
  send.onclick = submit;
  input.onkeydown = function (e) { if (e.key === "Enter") submit(); };
})();
`.trim();

// Full-screen demo page — styled to actually match cosmedixclinics.com.au
// (white, black text, modern sans-serif, minimalist, black CTA buttons),
// not an original mockup. Real site content (nav items, hero copy pattern)
// referenced from the verified fetch of the homepage.
const DEMO_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Cosmedix Clinics — Concierge Preview</title>
<style>
  * { box-sizing: border-box; }
  html, body { max-width: 100%; overflow-x: hidden; }
  body {
    margin: 0;
    min-height: 100vh;
    background: ${PAPER};
    color: ${INK};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  header { border-bottom: 1px solid ${LINE}; padding: 18px 24px; }
  .nav-row { max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; }
  .wordmark { font-weight: 700; font-size: 18px; letter-spacing: -.01em; color: ${INK}; }
  .nav-links { display: flex; gap: 22px; font-size: 12.5px; color: ${MUTED}; list-style: none; margin: 0; padding: 0; }
  .cta-btn { background: ${INK}; color: ${PAPER}; border: none; padding: 10px 20px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; border-radius: 2px; text-decoration: none; }
  main { max-width: 640px; margin: 0 auto; padding: 60px 24px 40px; text-align: left; }
  main h1 { font-weight: 700; font-size: clamp(26px, 4vw, 34px); line-height: 1.25; margin: 0 0 14px; color: ${INK}; }
  main p { font-size: 14.5px; line-height: 1.7; color: ${MUTED}; max-width: 54ch; margin: 0 0 8px; }
  .note { display: inline-block; margin-top: 18px; font-size: 11px; color: ${MUTED}; border: 1px solid ${LINE}; border-radius: 20px; padding: 6px 14px; }
  .foot { text-align: center; font-size: 10.5px; letter-spacing: .03em; color: #9a9a9a; padding: 20px 24px 32px; }
</style>
</head>
<body>
<header>
  <div class="nav-row">
    <div class="wordmark">COSMEDIX CLINICS</div>
    <ul class="nav-links">
      <li>Concerns</li>
      <li>Treatments</li>
      <li>About</li>
    </ul>
    <a class="cta-btn" href="https://bookings.gettimely.com/cosmedixclinics/bb/book" target="_blank" rel="noopener">Book Appointment</a>
  </div>
</header>
<main>
  <h1>A concierge for the clinic, answering exactly like your team would.</h1>
  <p>Click "Ask a question" in the bottom right to try it &mdash; grounded in Cosmedix's real treatments and process, answered live by Claude.</p>
  <p>Try asking it to reschedule an appointment or cancel a booking &mdash; that's a preview of what live rescheduling would feel like once it's connected to your real calendar.</p>
  <div class="note">Preview build &middot; rescheduling shown here is illustrative, not yet connected to a live calendar</div>
</main>
<div class="foot">Built for Cosmedix Clinics &middot; not yet installed on your site</div>
<script src="/widget.js"></script>
</body>
</html>`;

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.url === "/widget.js" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end(WIDGET_JS);
    return;
  }

  if (req.url === "/" && req.method === "GET") {
    logVisit(req, "page-view");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(DEMO_PAGE_HTML);
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    if (isRateLimited(getClientIp(req))) {
      sendJson(res, 429, { error: "Too many messages — please wait a bit and try again." });
      return;
    }
    logVisit(req, "chat-message");
    try {
      const { message } = await readJsonBody(req);
      if (!message || typeof message !== "string") {
        sendJson(res, 400, { error: "message (string) is required" });
        return;
      }
      const reply = await askClaude(message.slice(0, 1000));
      sendJson(res, 200, { reply });
    } catch (err) {
      console.error("Chat error:", err);
      sendJson(res, 500, { error: "Something went wrong — please try again." });
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Cosmedix Clinics chatbot (v2 — reschedule demo) listening on port ${PORT}`);
  console.log(`Embed snippet: <script src="http://localhost:${PORT}/widget.js"></script>`);
});
