const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TARIFF_LENGTH = 120;

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const getTextField = (body, name, maxLength, required = false) => {
  const value = body[name];
  if (value === undefined && !required) return "";
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (
    (required && !trimmed) ||
    trimmed.length > maxLength
  ) {
    return null;
  }
  return trimmed;
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.headers["content-type"]?.includes("application/json")) {
    return res.status(415).json({ error: "Expected application/json" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return res.status(400).json({ error: "Invalid submission" });
  }

  const name = getTextField(body, "name", MAX_NAME_LENGTH, true);
  const contact = getTextField(body, "contact", MAX_CONTACT_LENGTH, true);
  const message = getTextField(body, "message", MAX_MESSAGE_LENGTH);
  const tariff = getTextField(body, "tariff", MAX_TARIFF_LENGTH);

  if (
    name === null ||
    contact === null ||
    message === null ||
    tariff === null ||
    (!message && !tariff)
  ) {
    return res.status(400).json({ error: "Invalid or incomplete request" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Telegram integration is missing required environment variables");
    return res.status(500).json({ error: "Request delivery is not configured" });
  }

  const lines = [
    "<b>Новая заявка с сайта Neura</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Контакт:</b> ${escapeHtml(contact)}`,
  ];
  if (tariff) lines.push(`<b>Тариф:</b> ${escapeHtml(tariff)}`);
  if (message) lines.push(`<b>Сообщение:</b> ${escapeHtml(message)}`);

  let telegramResponse;
  try {
    telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join("\n"),
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    console.error("Telegram request failed", error.name);
    return res.status(502).json({ error: "Could not deliver the request" });
  }

  let result;
  try {
    result = await telegramResponse.json();
  } catch (error) {
    console.error("Could not read Telegram response", error);
    return res.status(502).json({ error: "Could not deliver the request" });
  }

  if (!telegramResponse.ok || !result || result.ok !== true) {
    console.error("Telegram rejected the request", {
      status: telegramResponse.status,
      description: result?.description,
    });
    return res.status(502).json({ error: "Could not deliver the request" });
  }

  return res.status(200).json({ ok: true });
};
