// Standalone demo chatbot for Universal Tailors (universaltailor.com) — a free
// founding-client offer per the outreach plan. Embeds via a single <script> tag,
// same "raw fetch to Anthropic" pattern as app-server.mjs (no SDK dependency added).
import http from "node:http";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.TAILOR_CHATBOT_PORT || 3002;

if (!ANTHROPIC_API_KEY) {
  console.error("Missing required env var: ANTHROPIC_API_KEY");
  process.exit(1);
}

// Verified 2026-07-04 from https://universaltailor.com/about-us/ — only facts
// actually published on the business's own site. Nothing here is invented;
// if it changes, update this block before the bot goes stale.
const BUSINESS_INFO = `
Business: Universal Tailors
Recognition: Rated the Best Tailor in Bangkok by GQ
Address: 252/2 Silom Road, next to Soi 18, Bangrak, Bangkok 10500, Thailand
Phone: +66 85 022 9489
Email: info@universaltailor.com
Hours: Monday-Saturday 10am-8pm, Sunday 1pm-6pm
Founded: 1985 (currently run by a father and son)
Services: bespoke suits and shirts, overcoats, smoking jackets, summer jackets, morning coats, dinner jackets, wedding tuxedos, custom business attire
Craftsmanship: floating canvas construction, extensive handwork, up to five craftsmen and up to 20 hours per suit, takes several days to complete
Materials: fabrics ethically sourced from IWTO-certified farms
Clientele: local professionals and international visitors
Booking: consultations/appointments can be requested via the website
`.trim();

const SYSTEM_PROMPT = `You are the website chat assistant for Universal Tailors, a bespoke tailoring shop in Bangkok. Answer visitor questions using ONLY the business information below — never invent prices, stock, delivery times, or any detail not listed here.

${BUSINESS_INFO}

Rules:
- If a question is answered by the info above, answer it directly and briefly (2-4 sentences).
- If a question asks for something not in the info above (exact pricing, current fabric stock, order status, appointment availability on a specific date), say you don't have that on hand and offer to have someone from Universal Tailors follow up directly — do not guess.
- Never state a price, delivery date, or availability as fact unless it appears above.
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
      max_tokens: 300,
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

// Palette pulled from universaltailor.com's own coded colors, confirmed
// 2026-07-04: their nav is a neutral charcoal (not navy), their CTA button
// is navy blue — two distinct dark tones, not one. Matched here as
// NAVY_DEEP (charcoal, header) and NAVY (their actual button blue, accents).
const NAVY = "#122142";
const NAVY_DEEP = "#1a1a1d";
const GOLD = "#a9895a";
const CREAM = "#faf8f4";
const INK = "#1f2937";

const WIDGET_JS = `
(function () {
  var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  var SERIF = "Georgia,'Times New Roman',serif";
  var LOGO = "https://universaltailor.com/wp-content/uploads/2018/06/logo-white.png";
  var ADDRESS = "252/2 Silom Road, Bangrak, Bangkok 10500, Thailand";
  var PHONE = "+66850229489";
  var EMAIL = "info@universaltailor.com";

  var style = document.createElement("style");
  style.textContent =
    // launcher
    "#ut-launcher{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;padding:13px 20px;border:none;border-radius:2px;background:${NAVY};color:${CREAM};font-family:" + FONT + ";font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;box-shadow:0 6px 20px rgba(11,23,48,.25);transition:transform .15s ease,box-shadow .15s ease;}" +
    "#ut-launcher:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(11,23,48,.32);}" +
    "#ut-launcher .ut-mark{font-family:" + SERIF + ";font-size:15px;letter-spacing:0;text-transform:none;border:1px solid ${GOLD};color:${GOLD};width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;}" +
    // panel shell — width/height use min() so a short or narrow phone
    // viewport shrinks the panel instead of clipping it off-screen
    "#ut-panel{position:fixed;bottom:16px;right:16px;z-index:9999;width:min(360px,calc(100vw - 32px));max-height:0;opacity:0;transform:translateY(10px) scale(.97);pointer-events:none;overflow:hidden;background:${CREAM};border-radius:4px;box-shadow:0 24px 60px rgba(11,23,48,.32);font-family:" + FONT + ";transition:max-height .32s cubic-bezier(.4,0,.2,1),opacity .22s ease,transform .22s ease;}" +
    "#ut-panel.ut-open{max-height:min(560px,calc(100vh - 32px));opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
    // header — faint pinstripe texture, a quiet nod to the fabric itself
    "#ut-head{background:${NAVY_DEEP} repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 1px,transparent 1px 9px);color:${CREAM};padding:22px 22px 16px;position:relative;}" +
    "#ut-head .ut-logo{height:20px;display:block;filter:brightness(0) invert(1);}" +
    "#ut-head .ut-sub{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:${GOLD};margin-top:9px;}" +
    "#ut-head .ut-rule{height:1px;background:linear-gradient(90deg,${GOLD},transparent);margin-top:14px;}" +
    "#ut-close{position:absolute;top:16px;right:18px;background:none;border:none;color:${CREAM};opacity:.55;font-size:15px;line-height:1;cursor:pointer;transition:opacity .15s ease;}" +
    "#ut-close:hover{opacity:1;}" +
    // sliding two-screen body — height also shrinks on short viewports
    // rather than clipping the bottom of the log/input row
    "#ut-body{position:relative;overflow:hidden;height:min(398px,calc(100vh - 190px));}" +
    "#ut-screens{display:flex;width:200%;height:100%;transition:transform .34s cubic-bezier(.4,0,.2,1);}" +
    "#ut-screens.ut-at-chat{transform:translateX(-50%);}" +
    ".ut-view{width:50%;flex-shrink:0;display:flex;flex-direction:column;height:100%;box-sizing:border-box;}" +
    // home screen
    "#ut-home{padding:22px;}" +
    "#ut-home h3{font-family:" + SERIF + ";font-weight:400;font-size:19px;color:${NAVY};margin:0 0 6px;}" +
    "#ut-home p{font-size:12.5px;color:#7a7364;line-height:1.6;margin:0 0 20px;}" +
    ".ut-action{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-top:1px solid #ece6d8;padding:14px 2px;text-align:left;font-family:" + FONT + ";font-size:13.5px;color:${INK};cursor:pointer;transition:padding-left .15s ease,color .15s ease;text-decoration:none;box-sizing:border-box;}" +
    ".ut-action:last-child{border-bottom:1px solid #ece6d8;}" +
    ".ut-action:hover{padding-left:8px;color:${NAVY};}" +
    ".ut-action .ut-chev{color:${GOLD};font-size:15px;}" +
    // chat screen
    "#ut-chat{}" +
    "#ut-chatbar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #ece6d8;flex-shrink:0;}" +
    "#ut-back{background:none;border:none;color:${NAVY};font-size:13px;cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-family:" + FONT + ";}" +
    "#ut-back:hover{color:${GOLD};}" +
    "#ut-log{flex:1;padding:16px 18px;overflow-y:auto;background:${CREAM};}" +
    "#ut-log::-webkit-scrollbar{width:5px;}#ut-log::-webkit-scrollbar-thumb{background:#e3ddd0;border-radius:3px;}" +
    ".ut-msg{font-size:13.5px;line-height:1.55;margin:0 0 14px;max-width:88%;}" +
    ".ut-msg.ut-user{margin-left:auto;color:${CREAM};background:${NAVY};padding:9px 13px;border-radius:2px;}" +
    ".ut-msg.ut-bot{color:${INK};padding-left:12px;border-left:2px solid ${GOLD};}" +
    ".ut-empty{font-size:12.5px;color:#8a8378;font-style:italic;padding:2px 0 8px;}" +
    "#ut-row{display:flex;border-top:1px solid #e9e3d6;background:${CREAM};flex-shrink:0;}" +
    "#ut-input{flex:1;border:none;background:transparent;padding:14px 16px;font-size:13.5px;font-family:" + FONT + ";outline:none;color:${INK};}" +
    "#ut-input::placeholder{color:#a39c8d;}" +
    "#ut-send{border:none;background:transparent;color:${NAVY};font-family:" + SERIF + ";font-size:13px;letter-spacing:.04em;padding:0 18px;cursor:pointer;border-left:1px solid #e9e3d6;transition:color .15s ease;}" +
    "#ut-send:hover{color:${GOLD};}" +
    "@media (prefers-reduced-motion:reduce){#ut-launcher,#ut-panel,#ut-screens,.ut-action,#ut-close,#ut-back,#ut-send{transition:none !important;}}";
  document.head.appendChild(style);

  var launcher = document.createElement("button");
  launcher.id = "ut-launcher";
  launcher.innerHTML = '<span class="ut-mark">UT</span><span>Ask a question</span>';
  document.body.appendChild(launcher);

  var panel = document.createElement("div");
  panel.id = "ut-panel";
  panel.innerHTML =
    '<div id="ut-head"><button id="ut-close" aria-label="Close">\\u2715</button>' +
    '<img class="ut-logo" src="' + LOGO + '" alt="Universal Tailors" />' +
    '<div class="ut-sub">Rated Bangkok\\u2019s Best Tailor \\u2014 GQ \\u00B7 Est. 1985</div>' +
    '<div class="ut-rule"></div></div>' +
    '<div id="ut-body"><div id="ut-screens">' +
      '<div class="ut-view" id="ut-home">' +
        '<h3>How can we help?</h3>' +
        '<p>Reach the atelier on Silom Road directly, or ask us anything.</p>' +
        '<button class="ut-action" id="ut-go-chat">Ask a question<span class="ut-chev">\\u203A</span></button>' +
        '<a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ADDRESS) + '">Visit the atelier<span class="ut-chev">\\u203A</span></a>' +
        '<a class="ut-action" href="tel:' + PHONE + '">Call us<span class="ut-chev">\\u203A</span></a>' +
        '<a class="ut-action" href="mailto:' + EMAIL + '">Email us<span class="ut-chev">\\u203A</span></a>' +
      '</div>' +
      '<div class="ut-view" id="ut-chat">' +
        '<div id="ut-chatbar"><button id="ut-back">\\u2039 Back</button></div>' +
        '<div id="ut-log"><div class="ut-empty">Ask about our suits, appointments, or the atelier on Silom Road.</div></div>' +
        '<div id="ut-row"><input id="ut-input" placeholder="Type your question..." /><button id="ut-send">Send</button></div>' +
      '</div>' +
    '</div></div>';
  document.body.appendChild(panel);

  var screens = panel.querySelector("#ut-screens");
  var log = panel.querySelector("#ut-log");
  var input = panel.querySelector("#ut-input");
  var send = panel.querySelector("#ut-send");
  var open = false;

  function toggle(force) {
    open = typeof force === "boolean" ? force : !open;
    panel.classList.toggle("ut-open", open);
  }
  function goChat() {
    screens.classList.add("ut-at-chat");
    setTimeout(function () { input.focus(); }, 200);
  }
  function goHome() {
    screens.classList.remove("ut-at-chat");
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

  async function submit() {
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    try {
      var res = await fetch((window.UT_CHAT_ENDPOINT || "") + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      addMsg(data.reply || "Something went wrong \\u2014 please try again.", "bot");
    } catch (e) {
      addMsg("Something went wrong \\u2014 please try again.", "bot");
    }
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
<title>Universal Tailors — Concierge Preview</title>
<style>
  :root {
    --navy: ${NAVY};
    --navy-deep: ${NAVY_DEEP};
    --gold: ${GOLD};
    --cream: ${CREAM};
    --ink: ${INK};
    --line: #ece6d8;
  }
  * { box-sizing: border-box; }
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
    background-color: var(--navy-deep);
    background-image: repeating-linear-gradient(115deg, rgba(255,255,255,.045) 0 1px, transparent 1px 10px);
    border-bottom: 2px solid var(--gold);
    padding: 22px 24px 18px;
  }
  .brand-row { max-width: 640px; margin: 0 auto; display: flex; align-items: center; gap: 14px; }
  .mark { flex-shrink: 0; width: 42px; height: 42px; border: 1px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: Georgia, "Times New Roman", serif; font-size: 16px; color: var(--gold); }
  .wordmark { font-family: Georgia, "Times New Roman", serif; font-size: clamp(19px, 3vw, 24px); letter-spacing: .06em; color: var(--cream); line-height: 1.1; }
  .wordmark small { display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--gold); margin-top: 4px; }
  main { flex: 1 0 auto; display: flex; justify-content: center; padding: 24px 20px 40px; }
  #ut-body { width: 100%; max-width: 640px; position: relative; overflow-x: hidden; }
  #ut-screens { display: flex; width: 200%; align-items: stretch; transition: transform .36s cubic-bezier(.4,0,.2,1); }
  #ut-screens.ut-at-chat { transform: translateX(-50%); }
  .ut-view { width: 50%; flex-shrink: 0; display: flex; flex-direction: column; min-height: 420px; box-sizing: border-box; }
  #ut-home { padding: 32px 8px 24px; }
  #ut-home h1 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; font-size: clamp(26px, 4vw, 34px); line-height: 1.28; color: var(--navy); text-wrap: balance; margin: 0 0 14px; }
  #ut-home .lede { font-size: 14.5px; line-height: 1.7; color: #6b6455; max-width: 46ch; margin: 0 0 30px; }
  .ut-action{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;border-top:1px solid var(--line);padding:18px 4px;text-align:left;font-size:15px;color:var(--ink);cursor:pointer;transition:padding-left .15s ease,color .15s ease;text-decoration:none;box-sizing:border-box;}
  .ut-action:last-child{border-bottom:1px solid var(--line);}
  .ut-action:hover{padding-left:10px;color:var(--navy);}
  .ut-action .ut-chev{color:var(--gold);font-size:17px;}
  #ut-chat { padding-top: 20px; }
  #ut-chatbar { display: flex; align-items: center; padding: 0 4px 16px; flex-shrink: 0; }
  #ut-back { background: none; border: none; color: var(--navy); font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 5px; padding: 4px; }
  #ut-back:hover { color: var(--gold); }
  #ut-log { flex: 1 1 auto; overflow-y: auto; padding: 4px; max-height: min(50vh, 420px); }
  .ut-msg{font-size:14.5px;line-height:1.6;margin:0 0 16px;max-width:82%;}
  .ut-msg.ut-user{margin-left:auto;color:var(--cream);background:var(--navy);padding:11px 15px;border-radius:2px;}
  .ut-msg.ut-bot{color:var(--ink);padding-left:14px;border-left:2px solid var(--gold);}
  .ut-empty{font-size:13px;color:#8a8378;font-style:italic;padding:2px 0 8px;}
  #ut-row { display: flex; border-top: 1px solid var(--line); flex-shrink: 0; margin-top: 8px; }
  #ut-input { flex: 1; border: none; background: transparent; padding: 16px 6px; font-size: 14.5px; outline: none; color: var(--ink); }
  #ut-input::placeholder { color: #a39c8d; }
  #ut-send { border: none; background: transparent; color: var(--navy); font-family: Georgia, "Times New Roman", serif; font-size: 14px; letter-spacing: .04em; padding: 0 6px 0 18px; cursor: pointer; transition: color .15s ease; }
  #ut-send:hover { color: var(--gold); }
  .foot { flex-shrink: 0; text-align: center; font-size: 10.5px; letter-spacing: .04em; color: #a39c8d; padding: 12px 24px; }
  @media (prefers-reduced-motion: reduce) { #ut-screens, .ut-action, #ut-back, #ut-send { transition: none !important; } }
</style>
</head>
<body>
<header>
  <div class="brand-row">
    <div class="mark">UT</div>
    <div class="wordmark">Universal Tailors<small>Rated Bangkok&rsquo;s Best Tailor &mdash; GQ &middot; Est. 1985</small></div>
  </div>
</header>
<main>
  <div id="ut-body">
    <div id="ut-screens">
      <div class="ut-view" id="ut-home">
        <h1>A concierge for your atelier, built to answer like you would.</h1>
        <p class="lede">Ask a real question below &mdash; this is grounded in Universal Tailors&rsquo; real hours, services, and address, and answered live by Claude.</p>
        <button class="ut-action" id="ut-go-chat">Ask a question<span class="ut-chev">&rsaquo;</span></button>
        <a class="ut-action" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=252%2F2%20Silom%20Road%2C%20Bangrak%2C%20Bangkok%2010500%2C%20Thailand">Visit the atelier<span class="ut-chev">&rsaquo;</span></a>
        <a class="ut-action" href="tel:+66850229489">Call us<span class="ut-chev">&rsaquo;</span></a>
        <a class="ut-action" href="mailto:info@universaltailor.com">Email us<span class="ut-chev">&rsaquo;</span></a>
      </div>
      <div class="ut-view" id="ut-chat">
        <div id="ut-chatbar"><button id="ut-back">&lsaquo; Back</button></div>
        <div id="ut-log"><div class="ut-empty">Ask about our suits, appointments, or the atelier on Silom Road.</div></div>
        <div id="ut-row">
          <input id="ut-input" placeholder="Type your question..." />
          <button id="ut-send">Send</button>
        </div>
      </div>
    </div>
  </div>
</main>
<div class="foot">Built for Universal Tailors &middot; not yet installed on your site</div>
<script>
  var screens = document.getElementById("ut-screens");
  var log = document.getElementById("ut-log");
  var input = document.getElementById("ut-input");
  var send = document.getElementById("ut-send");

  function goChat() { screens.classList.add("ut-at-chat"); setTimeout(function () { input.focus(); }, 220); }
  function goHome() { screens.classList.remove("ut-at-chat"); }
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

  async function submit() {
    var text = input.value.trim();
    if (!text) return;
    addMsg(text, "user");
    input.value = "";
    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      var data = await res.json();
      addMsg(data.reply || "Something went wrong — please try again.", "bot");
    } catch (e) {
      addMsg("Something went wrong — please try again.", "bot");
    }
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
  console.log(`Tailor chatbot listening on port ${PORT}`);
  console.log(`Embed snippet: <script src="http://localhost:${PORT}/widget.js"></script>`);
});
