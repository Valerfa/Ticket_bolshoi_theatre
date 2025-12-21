require("dotenv").config();
const fs = require("fs");
const crypto = require("crypto");
const { chromium } = require("playwright");

const URL = "https://bolshoi.ru/performances/ballet/master-and-margarita";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.");
  process.exit(1);
}

const STATE_DIR = "./state";
const HASH_FILE = `${STATE_DIR}/last_hash.txt`;

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

async function sendTelegram(text) {
  const resp = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Telegram error: ${resp.status} ${body}`);
  }
}

(async () => {
  fs.mkdirSync(STATE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
  });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  const html = await page.content();
  await browser.close();

  const currentHash = sha256(html);
  const prevHash = fs.existsSync(HASH_FILE)
    ? fs.readFileSync(HASH_FILE, "utf8").trim()
    : null;

  if (prevHash !== currentHash) {
    fs.writeFileSync(HASH_FILE, currentHash, "utf8");
    await sendTelegram(`🔔 Изменение HTML на странице:\n${URL}\n\nold: ${prevHash ?? "<none>"}\nnew: ${currentHash}`);
    console.log("Change detected. Notified.");
  } else {
    console.log("No changes.");
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});