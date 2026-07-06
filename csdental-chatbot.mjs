// Standalone demo chatbot for CS Dental Bali (csdental.id) — same
// template/architecture as tailor-chatbot.mjs, rivaado-chatbot.mjs, and
// vbp-chatbot.mjs, re-skinned with this clinic's real colors and facts.
// Embeds via a single <script> tag, same "raw fetch to Anthropic" pattern
// as app-server.mjs (no SDK dependency added).
import http from "node:http";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.CSDENTAL_CHATBOT_PORT || 3005;

if (!ANTHROPIC_API_KEY) {
  console.error("Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

// Basic abuse protection — this endpoint is public and each call costs real
// Anthropic API money, so cap it per visitor rather than leaving it wide open.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitLog = new Map(); // ip -> recent request timestamps

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
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

// Periodic cleanup so the map doesn't grow forever on a long-running instance.
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitLog) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitLog.delete(ip);
    else rateLimitLog.set(ip, recent);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

// Verified 2026-07-06 from csdental.id, its location pages, and the
// WhatsApp numbers embedded directly in each location page's source (their
// own site had the two locations' address text mixed up between page URLs —
// cross-checked each address against its page's actual WhatsApp link to pair
// them correctly). No email found anywhere on the site — deliberately
// omitted rather than guessed. Nothing here is invented; if it changes,
// update this block before the bot goes stale.
const BUSINESS_INFO = `
Business: CS Dental Bali
History: trusted by more than 10,000 patients since 2008, starting in Surabaya; operates under the supervision of Dr. Cindy Saconk
Locations: two clinics in Bali —
  1) Kuta/Tuban: Jl. Bypass Ngurah Rai No. 7, Tuban, Kuta, Badung, Bali 80361 (next to BCA bank and Kopi Kenangan). WhatsApp: +62 813-9079-0001
  2) Canggu: Jl. Raya Canggu No.18 A, Tibubeneng, Kec. Kuta Utara, Kabupaten Badung, Bali 80361. WhatsApp: +62 811-3961-9102
Hours (both locations): Monday-Friday 08:00-22:00, Saturday-Sunday 10:00-22:00
Email: not published anywhere on the site — if asked, say you're not sure and offer WhatsApp or an in-person visit instead.
Services: veneers, dental implants (including All-on-X), Invisalign / clear braces, metal braces, scaling, fillings, cosmetic dentistry with zirconia and porcelain crowns, root canal therapy, and an in-house CAD/CAM dental laboratory for fast restorations
Clientele: known for serving international patients — clear written treatment plans, English-speaking staff, long opening hours
Booking: consultations can be requested via WhatsApp for either location
`.trim();

const SYSTEM_PROMPT = `You are the website chat assistant for CS Dental Bali, a dental clinic with two locations in Bali (Kuta/Tuban and Canggu). Answer visitor questions using ONLY the business information below — never invent prices, availability, or any detail not listed here.

${BUSINESS_INFO}

Rules:
- If a question is answered by the info above, answer it directly and briefly (2-4 sentences).
- If the visitor doesn't specify which location, and the answer differs by location (e.g. exact address, which WhatsApp to use), ask which location they mean or offer both.
- If a question asks for something not in the info above (exact pricing, appointment availability on a specific date, insurance coverage specifics), say you don't have that on hand and offer to have someone from the clinic follow up directly on WhatsApp — do not guess.
- If asked about price/cost, mention that it depends on the treatment and materials chosen before saying you don't have exact figures.
- If asked about booking, invite them to leave their details in the chat, or message the clinic directly on WhatsApp for the location they want.
- CRITICAL — this is a healthcare business: never diagnose, assess, or give dental/medical advice about someone's teeth, pain, or condition, and never suggest a specific treatment is right for them. If someone describes a symptom or asks "should I get..." / "what's wrong with...", tell them a dentist needs to examine them in person to assess it properly, and offer to help them reach the clinic on WhatsApp. Do not speculate about causes, diagnoses, or severity.
- Never state a price, availability, or medical/dental outcome as fact unless it appears above.
- Keep tone warm and professional, not salesy. No emoji.`;

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

// Palette pulled directly from csdental.id's own coded CSS hex values
// (confirmed 2026-07-06 via the page source — #2ea3f2 is the clearly
// dominant, repeated brand blue, not a one-off theme default).
const BLUE = "#2ea3f2";
const BLUE_DEEP = "#1f7ec2";
const DARK = "#2c2c2c";
const CREAM = "#ffffff";
const INK = "#1f2937";

const WIDGET_JS = `
(function () {
  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  var KUTA_ADDRESS = "Jl. Bypass Ngurah Rai No. 7, Tuban, Kuta, Badung, Bali 80361";
  var KUTA_WA = "6281390790001";
  var CANGGU_ADDRESS = "Jl. Raya Canggu No.18 A, Tibubeneng, Kec. Kuta Utara, Kabupaten Badung, Bali 80361";
  var CANGGU_WA = "6281139619102";

  var style = document.createElement("style");
  style.textContent =
    // launcher
    "#ut-launcher{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;padding:13px 20px;border:none;border-radius:2px;background:${BLUE};color:${CREAM};font-family:" + FONT + ";font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 20px rgba(31,126,194,.3);transition:transform .15s ease,box-shadow .15s ease;}" +
    "#ut-launcher:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(31,126,194,.38);}" +
    "#ut-launcher .ut-mark{font-family:" + FONT + ";font-weight:800;font-size:13px;letter-spacing:0;text-transform:none;background:${CREAM};color:${BLUE};width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;}" +
    // panel shell — width/height use min() so a short or narrow phone
    // viewport shrinks the panel instead of clipping it off-screen
    "#ut-panel{position:fixed;bottom:16px;right:16px;z-index:9999;width:min(360px,calc(100vw - 32px));max-height:0;opacity:0;transform:translateY(10px) scale(.97);pointer-events:none;overflow:hidden;background:${CREAM};border-radius:4px;box-shadow:0 24px 60px rgba(31,126,194,.35);font-family:" + FONT + ";transition:max-height .32s cubic-bezier(.4,0,.2,1),opacity .22s ease,transform .22s ease;}" +
    "#ut-panel.ut-open{max-height:min(600px,calc(100vh - 32px));opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
    "#ut-head{background:${BLUE_DEEP};color:${CREAM};padding:20px 22px 16px;position:relative;}" +
    "#ut-head .ut-wordmark{font-family:" + FONT + ";font-weight:700;font-size:16px;letter-spacing:.01em;}" +
    "#ut-head .ut-sub{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#d8eefc;margin-top:8px;}" +
    "#ut-close{position:absolute;top:14px;right:16px;background:none;border:none;color:${CREAM};opacity:.7;font-size:15px;line-height:1;cursor:pointer;transition:opacity .15s ease;}" +
    "#ut-close:hover{opacity:1;}" +
    // simple show/hide between the two screens — no width:200%/transform
    // sliding trick, so there's no adjacent-pane geometry to misalign
    "#ut-body{position:relative;}" +
    ".ut-view{display:none;flex-direction:column;box-sizing:border-box;overflow-wrap:break-word;word-break:break-word;opacity:0;transition:opacity .2s ease;}" +
    ".ut-view.ut-active{display:flex;opacity:1;}" +
    // home screen
    "#ut-home{padding:22px;}" +
    "#ut-home h3{font-family:" + FONT + ";font-weight:700;font-size:18px;color:${DARK};margin:0 0 6px;}" +
    "#ut-home p{font-size:12.5px;color:#726c63;line-height:1.6;margin:0 0 18px;}" +
    ".ut-group-label{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BLUE};margin:14px 0 2px;}" +
    ".ut-action{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-top:1px solid #eaeaea;padding:13px 2px;text-align:left;font-family:" + FONT + ";font-size:13.5px;color:${INK};cursor:pointer;transition:padding-left .15s ease,color .15s ease;text-decoration:none;box-sizing:border-box;}" +
    ".ut-action:last-child{border-bottom:1px solid #eaeaea;}" +
    ".ut-action:hover{padding-left:8px;color:${DARK};}" +
    ".ut-action-text{display:flex;flex-direction:column;gap:2px;}" +
    ".ut-action-detail{font-size:11px;font-weight:400;color:#8a8378;}" +
    ".ut-action .ut-chev{color:${BLUE};font-size:15px;flex-shrink:0;margin-left:10px;}" +
    // chat screen
    "#ut-chat{}" +
    "#ut-chatbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #eaeaea;flex-shrink:0;}" +
    "#ut-back{background:none;border:none;color:${DARK};font-size:13px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-family:" + FONT + ";}" +
    "#ut-back:hover{color:${BLUE};}" +
    "#ut-log{flex:1;padding:16px 18px;overflow-y:auto;overflow-wrap:anywhere;max-height:min(50vh,360px);background:${CREAM};}" +
    "#ut-log::-webkit-scrollbar{width:5px;}#ut-log::-webkit-scrollbar-thumb{background:#e3ddd0;border-radius:3px;}" +
    ".ut-msg{font-size:13.5px;line-height:1.55;margin:0 0 14px;max-width:88%;overflow-wrap:break-word;word-break:break-word;}" +
    ".ut-msg.ut-user{margin-left:auto;color:${CREAM};background:${BLUE};padding:9px 13px;border-radius:2px;}" +
    ".ut-msg.ut-bot{color:${INK};padding-left:12px;border-left:2px solid ${BLUE};}" +
    ".ut-empty{font-size:12.5px;color:#8a8378;font-style:italic;padding:2px 0 8px;}" +
    ".ut-typing{display:flex;gap:4px;padding:12px 14px;margin:0 0 14px;}" +
    ".ut-typing span{width:5px;height:5px;border-radius:50%;background:${BLUE};opacity:.5;animation:ut-blink 1.2s ease-in-out infinite;}" +
    ".ut-typing span:nth-child(2){animation-delay:.2s;}.ut-typing span:nth-child(3){animation-delay:.4s;}" +
    "@keyframes ut-blink{0%,80%,100%{opacity:.3;}40%{opacity:1;}}" +
    "#ut-row{display:flex;border-top:1px solid #eaeaea;background:${CREAM};flex-shrink:0;}" +
    "#ut-input{flex:1;border:none;background:transparent;padding:14px 16px;font-size:13.5px;font-family:" + FONT + ";outline:none;color:${INK};}" +
    "#ut-input::placeholder{color:#a39c8d;}" +
    "#ut-input:disabled{color:#a39c8d;}" +
    "#ut-send{border:none;background:transparent;color:${DARK};font-family:" + FONT + ";font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:0 18px;cursor:pointer;border-left:1px solid #eaeaea;transition:color .15s ease;}" +
    "#ut-send:hover{color:${BLUE};}" +
    "#ut-send:disabled{color:#c9c2b3;cursor:default;}" +
    "@media (prefers-reduced-motion:reduce){#ut-launcher,#ut-panel,.ut-view,.ut-action,#ut-close,#ut-back,#ut-send{transition:none !important;}}";
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.id = "ut-launcher";
  launcher.innerHTML = '<span class="ut-mark">CS</span><span>Ask a question</span>';
  document.body.appendChild(launcher);

  var panel = document.createElement("div");
  panel.id = "ut-panel";
  panel.innerHTML =
    '<div id="ut-head"><button id="ut-close" aria-label="Close">\\u2715</button>' +
    '<div class="ut-wordmark">CS Dental Bali</div>' +
    '<div class="ut-sub">Trusted Since 2008</div></div>' +
    '<div id="ut-body">' +
      '<div class="ut-view ut-active" id="ut-home">' +
        '<h3>How can we help?</h3>' +
        '<p>Reach either of our Bali clinics directly, or ask us anything.</p>' +
        '<button class="ut-action" id="ut-go-chat">Ask a question<span class="ut-chev">\\u203A</span></button>' +
        '<div class="ut-group-label">Kuta / Tuban</div>' +
        '<a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(KUTA_ADDRESS) + '">Visit the clinic<span class="ut-chev">\\u203A</span></a>' +
        '<a class="ut-action" target="_blank" rel="noopener" href="https://wa.me/' + KUTA_WA + '"><span class="ut-action-text">WhatsApp us<span class="ut-action-detail">+62 813-9079-0001</span></span><span class="ut-chev">\\u203A</span></a>' +
        '<div class="ut-group-label">Canggu</div>' +
        '<a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(CANGGU_ADDRESS) + '">Visit the clinic<span class="ut-chev">\\u203A</span></a>' +
        '<a class="ut-action" target="_blank" rel="noopener" href="https://wa.me/' + CANGGU_WA + '"><span class="ut-action-text">WhatsApp us<span class="ut-action-detail">+62 811-3961-9102</span></span><span class="ut-chev">\\u203A</span></a>' +
      '</div>' +
      '<div class="ut-view" id="ut-chat">' +
        '<div id="ut-chatbar"><button id="ut-back">\\u2039 Back</button></div>' +
        '<div id="ut-log" aria-live="polite"><div class="ut-empty">Ask about treatments, appointments, or either Bali location.</div></div>' +
        '<div id="ut-row"><input id="ut-input" placeholder="Type your question..." /><button id="ut-send">Send</button></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(panel);

  var homeView = panel.querySelector("#ut-home");
  var chatView = panel.querySelector("#ut-chat");
  var log = panel.querySelector("#ut-log");
  var input = panel.querySelector("#ut-input");
  var send = panel.querySelector("#ut-send");
  var open = false;

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    panel.classList.toggle("ut-open", open);
  }
  function goChat() {
    homeView.classList.remove("ut-active");
    chatView.classList.add("ut-active");
    setTimeout(function () { input.focus(); }, 200);
  }
  function goHome() {
    chatView.classList.remove("ut-active");
    homeView.classList.add("ut-active");
  }
  launcher.onclick = function () { toggle(); };
  panel.querySelector("#ut-close").onclick = function () { toggle(false); };
  panel.querySelector("#ut-go-chat").onclick = goChat;
  panel.querySelector("#ut-back").onclick = goHome;

  function addMsg(text, who) {
    var empty = log.querySelector(".ut-empty");
    if (empty) empty.remove();
    var p = document.createElement("div");
    p.className = "ut-msg " + (who === "user" ? "ut-user" : "ut-bot");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement("div");
    t.className = "ut-typing";
    t.id = "ut-typing-indicator";
    t.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    var t = document.getElementById("ut-typing-indicator");
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
      var res = await fetch((window.CSD_CHAT_ENDPOINT || "") + "/api/chat", {
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

// Full-screen demo page served at "/" — same visual design as the widget,
// but answers come from the real /api/chat endpoint (Claude), not a mock.
const DEMO_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CS Dental Bali — Concierge Preview</title>
<style>
  :root {
    --blue: ${BLUE};
    --blue-deep: ${BLUE_DEEP};
    --dark: ${DARK};
    --cream: ${CREAM};
    --ink: ${INK};
    --line: #eaeaea;
  }
  * { box-sizing: border-box; }
  html, body { max-width: 100%; overflow-x: hidden; }
  body {
    margin: 0;
    min-height: 100vh;
    background: var(--cream);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
  }
  header {
    flex-shrink: 0;
    background-color: var(--blue-deep);
    border-bottom: 2px solid var(--dark);
    padding: 20px 24px;
  }
  .brand-row { max-width: 640px; margin: 0 auto; display: flex; align-items: center; gap: 12px; }
  .mark { flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: var(--cream); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; color: var(--blue); }
  .wordmark { font-weight: 700; font-size: clamp(17px, 3vw, 21px); letter-spacing: .01em; color: var(--cream); line-height: 1.35; }
  .wordmark small { display: block; font-weight: 500; font-size: 10.5px; line-height: 1.6; letter-spacing: .08em; text-transform: uppercase; color: #d8eefc; margin-top: 3px; }
  main { flex: 1 0 auto; display: flex; justify-content: center; padding: 24px 20px 40px; }
  #ut-body { width: 100%; max-width: 640px; position: relative; }
  .ut-view { display: none; flex-direction: column; min-height: 420px; box-sizing: border-box; overflow-wrap: break-word; word-break: break-word; opacity: 0; transition: opacity .2s ease; }
  .ut-view.ut-active { display: flex; opacity: 1; }
  #ut-home { padding: 32px 8px 24px; }
  #ut-home h1 { font-weight: 700; font-size: clamp(24px, 4vw, 31px); line-height: 1.3; color: var(--dark); text-wrap: balance; margin: 0 0 14px; }
  #ut-home .lede { font-size: 14.5px; line-height: 1.7; color: #6b6455; max-width: 46ch; margin: 0 0 20px; }
  .ut-group-label { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--blue); margin: 18px 0 2px; }
  .ut-action{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-top:1px solid var(--line);padding:13px 4px;text-align:left;font-size:15px;color:var(--ink);cursor:pointer;transition:padding-left .15s ease,color .15s ease;text-decoration:none;box-sizing:border-box;}
  .ut-action:last-child{border-bottom:1px solid var(--line);}
  .ut-action:hover{padding-left:10px;color:var(--dark);}
  .ut-action-text{display:flex;flex-direction:column;gap:2px;}
  .ut-action-detail{font-size:12px;font-weight:400;color:#8a8378;}
  .ut-action .ut-chev{color:var(--blue);font-size:17px;flex-shrink:0;margin-left:12px;}
  #ut-chat { padding-top: 20px; }
  #ut-chatbar { display: flex; align-items: center; padding: 0 4px 16px; flex-shrink: 0; }
  #ut-back { background: none; border: none; color: var(--dark); font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 4px; }
  #ut-back:hover { color: var(--blue); }
  #ut-log { flex: 1 1 auto; overflow-y: auto; overflow-wrap: anywhere; padding: 4px 4px 18px; max-height: min(50vh, 420px); }
  .ut-msg{font-size:14.5px;line-height:1.6;margin:0 0 16px;max-width:82%;overflow-wrap:break-word;word-break:break-word;}
  .ut-msg.ut-user{margin-left:auto;color:var(--cream);background:var(--blue);padding:11px 15px;border-radius:2px;}
  .ut-msg.ut-bot{color:var(--ink);padding-left:14px;border-left:2px solid var(--blue-deep);}
  .ut-empty{font-size:13px;color:#8a8378;font-style:italic;padding:2px 0 8px;}
  .ut-typing{display:flex;gap:4px;padding:12px 14px 12px 14px;margin:0 0 16px;}
  .ut-typing span{width:5px;height:5px;border-radius:50%;background:var(--blue);opacity:.5;animation:ut-blink 1.2s ease-in-out infinite;}
  .ut-typing span:nth-child(2){animation-delay:.2s;}
  .ut-typing span:nth-child(3){animation-delay:.4s;}
  @keyframes ut-blink{0%,80%,100%{opacity:.3;}40%{opacity:1;}}
  #ut-row { display: flex; border-top: 1px solid var(--line); flex-shrink: 0; margin-top: 8px; }
  #ut-input { flex: 1; border: none; background: transparent; padding: 16px 6px; font-size: 14.5px; outline: none; color: var(--ink); }
  #ut-input::placeholder { color: #a39c8d; }
  #ut-input:disabled { color: #a39c8d; }
  #ut-send { border: none; background: transparent; color: var(--dark); font-weight: 700; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; padding: 0 6px 0 18px; cursor: pointer; transition: color .15s ease; }
  #ut-send:hover { color: var(--blue); }
  #ut-send:disabled { color: #c9c2b3; cursor: default; }
  .foot { flex-shrink: 0; text-align: center; font-size: 10.5px; letter-spacing: .04em; color: #a39c8d; padding: 12px 24px; }
  @media (prefers-reduced-motion: reduce) { .ut-view, .ut-action, #ut-back, #ut-send { transition: none !important; } }
</style>
</head>
<body>
<header>
  <div class="brand-row">
    <div class="mark">CS</div>
    <div class="wordmark">CS Dental Bali<small>Trusted Since 2008</small></div>
  </div>
</header>
<main>
  <div id="ut-body">
    <div class="ut-view ut-active" id="ut-home">
      <h1>A concierge for your clinic, built to answer like you would.</h1>
      <p class="lede">Ask a real question below &mdash; grounded in CS Dental Bali's real services and both Bali locations, and answered live by Claude.</p>
      <button class="ut-action" id="ut-go-chat">Ask a question<span class="ut-chev">&rsaquo;</span></button>
      <div class="ut-group-label">Kuta / Tuban</div>
      <a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Jl.%20Bypass%20Ngurah%20Rai%20No.%207%2C%20Tuban%2C%20Kuta%2C%20Badung%2C%20Bali%2080361">Visit the clinic<span class="ut-chev">&rsaquo;</span></a>
      <a class="ut-action" target="_blank" rel="noopener" href="https://wa.me/6281390790001"><span class="ut-action-text">WhatsApp us<span class="ut-action-detail">+62 813-9079-0001</span></span><span class="ut-chev">&rsaquo;</span></a>
      <div class="ut-group-label">Canggu</div>
      <a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=Jl.%20Raya%20Canggu%20No.18%20A%2C%20Tibubeneng%2C%20Kec.%20Kuta%20Utara%2C%20Kabupaten%20Badung%2C%20Bali%2080361">Visit the clinic<span class="ut-chev">&rsaquo;</span></a>
      <a class="ut-action" target="_blank" rel="noopener" href="https://wa.me/6281139619102"><span class="ut-action-text">WhatsApp us<span class="ut-action-detail">+62 811-3961-9102</span></span><span class="ut-chev">&rsaquo;</span></a>
    </div>
    <div class="ut-view" id="ut-chat">
      <div id="ut-chatbar"><button id="ut-back">&lsaquo; Back</button></div>
      <div id="ut-log" aria-live="polite"><div class="ut-empty">Ask about treatments, appointments, or either Bali location.</div></div>
      <div id="ut-row">
        <input id="ut-input" placeholder="Type your question..." />
        <button id="ut-send">Send</button>
      </div>
    </div>
  </div>
</main>
<div class="foot">Built for CS Dental Bali &middot; not yet installed on your site</div>
<script>
  var homeView = document.getElementById("ut-home");
  var chatView = document.getElementById("ut-chat");
  var log = document.getElementById("ut-log");
  var input = document.getElementById("ut-input");
  var send = document.getElementById("ut-send");

  function goChat() {
    homeView.classList.remove("ut-active");
    chatView.classList.add("ut-active");
    setTimeout(function () { input.focus(); }, 220);
  }
  function goHome() {
    chatView.classList.remove("ut-active");
    homeView.classList.add("ut-active");
  }
  document.getElementById("ut-go-chat").onclick = goChat;
  document.getElementById("ut-back").onclick = goHome;

  function addMsg(text, who) {
    var empty = log.querySelector(".ut-empty");
    if (empty) empty.remove();
    var p = document.createElement("div");
    p.className = "ut-msg " + (who === "user" ? "ut-user" : "ut-bot");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    var t = document.createElement("div");
    t.className = "ut-typing";
    t.id = "ut-typing-indicator";
    t.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(t);
    log.scrollTop = log.scrollHeight;
  }
  function hideTyping() {
    var t = document.getElementById("ut-typing-indicator");
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
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      hideTyping();
      addMsg(data.reply || "Something went wrong — please try again.", "bot");
    } catch (e) {
      hideTyping();
      addMsg("Something went wrong — please try again.", "bot");
    }
    input.disabled = false;
    send.disabled = false;
    input.focus();
  }
  send.onclick = submit;
  input.onkeydown = function (e) { if (e.key === "Enter") submit(); };
</script>
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
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(DEMO_PAGE_HTML);
    return;
  }

  if (req.url === "/api/chat" && req.method === "POST") {
    if (isRateLimited(getClientIp(req))) {
      sendJson(res, 429, { error: "Too many messages — please wait a bit and try again." });
      return;
    }
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
  console.log(`CS Dental Bali chatbot listening on port ${PORT}`);
  console.log(`Embed snippet: <script src="http://localhost:${PORT}/widget.js"></script>`);
});
