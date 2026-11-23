const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TARIFF_LENGTH = 120;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

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
  if ((required && !trimmed) || trimmed.length > maxLength) return null;
  return trimmed;
};

const sendTelegramMessage = async (request, env) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ error: "Expected application/json" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return jsonResponse({ error: "Invalid submission" }, 400);
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
    return jsonResponse({ error: "Invalid or incomplete request" }, 400);
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("Telegram integration is missing required environment variables");
    return jsonResponse({ error: "Request delivery is not configured" }, 500);
  }

  const lines = [
    "<b>✨ Новая заявка с сайта Neura</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Контакт:</b> ${escapeHtml(contact)}`,
  ];
  if (tariff) lines.push(`<b>Тариф:</b> ${escapeHtml(tariff)}`);
  if (message) lines.push(`<b>Сообщение:</b> ${escapeHtml(message)}`);

  let telegramResponse;
  try {
    telegramResponse = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: lines.join("\n"),
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    console.error("Telegram request failed", error.name);
    return jsonResponse({ error: "Could not deliver the request" }, 502);
  }

  let result;
  try {
    result = await telegramResponse.json();
  } catch (error) {
    console.error("Could not read Telegram response", error);
    return jsonResponse({ error: "Could not deliver the request" }, 502);
  }

  if (!telegramResponse.ok || !result || result.ok !== true) {
    console.error("Telegram rejected the request", {
      status: telegramResponse.status,
      description: result?.description,
    });
    return jsonResponse({ error: "Could not deliver the request" }, 502);
  }

  return jsonResponse({ ok: true });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/send-telegram" && request.method === "POST") {
      return sendTelegramMessage(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
