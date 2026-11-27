const MAX_NAME_LENGTH = 120;
const MAX_CONTACT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_TARIFF_LENGTH = 120;
const TELEGRAM_BOT_FALLBACK =
  "Извините, сейчас не удалось подготовить ответ. Пожалуйста, нажмите «📞 Оставить заявку», и руководитель студии поможет вам.";
const TELEGRAM_START_TEXT =
  "Здравствуйте! 👋 Это студия Neura. Помогаем запускать сайты и внедрять ИИ-решения для бизнеса.\n\nВыберите, чем могу помочь:";
const TELEGRAM_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: "💎 Тарифы и сроки" }, { text: "🤖 Что такое ИИ-агент?" }],
    [{ text: "🌐 Наш сайт" }, { text: "📞 Оставить заявку", request_contact: true }],
  ],
  resize_keyboard: true,
};
const GIGACHAT_SYSTEM_PROMPT =
  "Ты — вежливый и дружелюбный ИИ-менеджер по продажам веб-студии Neura. " +
  "Кратко отвечай на вопросы о создании сайтов и ИИ-решениях, не обещай того, чего нет в тарифах. " +
  "Тарифы Neura: 1) продающий лендинг под ключ — 15 000 ₽, срок 1–3 дня; " +
  "2) лендинг + ИИ-чат-бот — 22 000 ₽, срок 2–4 дня; " +
  "3) комплекс: сайт + чат-бот + ИИ-агент — 30 000 ₽, срок 3–5 дней. " +
  "Отвечай кратко и дружелюбно и в конце мягко предлагай оставить телефон для бесплатного расчёта.";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const errorResponse = (error, status) =>
  jsonResponse({ ok: false, error }, status);

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

const getAliasedTextField = (body, names, maxLength, required = false) => {
  const name = names.find((field) => Object.hasOwn(body, field)) ?? names[0];
  return getTextField(body, name, maxLength, required);
};

const sendTelegramMessage = async (request, env) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Expected application/json", 415);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Invalid request body", 400);
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return errorResponse("Invalid submission", 400);
  }

  const name = getTextField(body, "name", MAX_NAME_LENGTH, true);
  const contact = getAliasedTextField(
    body,
    ["contact", "phone"],
    MAX_CONTACT_LENGTH,
    true,
  );
  const message = getAliasedTextField(body, ["message", "task"], MAX_MESSAGE_LENGTH);
  const tariff = getTextField(body, "tariff", MAX_TARIFF_LENGTH);

  if (
    name === null ||
    contact === null ||
    message === null ||
    tariff === null ||
    (!message && !tariff)
  ) {
    return errorResponse("Invalid or incomplete request", 400);
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("Telegram integration is missing required environment variables");
    return errorResponse("Request delivery is not configured", 500);
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
    console.error("Telegram request failed", error);
    return errorResponse(error.message || "Telegram request failed", 502);
  }

  let responseText;
  try {
    responseText = await telegramResponse.text();
  } catch (error) {
    console.error("Could not read Telegram response", error);
    return errorResponse(error.message || "Could not read Telegram response", 502);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = null;
  }

  if (!telegramResponse.ok || !result || result.ok !== true) {
    const error =
      typeof result?.description === "string" && result.description
        ? result.description
        : responseText || `Telegram returned HTTP ${telegramResponse.status}`;
    console.error("Telegram rejected the request", {
      status: telegramResponse.status,
      error,
    });
    return errorResponse(error, 502);
  }

  return jsonResponse({ ok: true });
};

const telegramApi = async (env, method, body) => {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    },
  );
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = null;
  }

  if (!response.ok || !result || result.ok !== true) {
    const error =
      typeof result?.description === "string" && result.description
        ? result.description
        : responseText || `Telegram returned HTTP ${response.status}`;
    throw new Error(error);
  }

  return result;
};

const sendBotMessage = (env, chatId, text, extra = {}) =>
  telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    ...extra,
  });

const getSenderName = (user, contact) =>
  [contact?.first_name || user?.first_name, contact?.last_name || user?.last_name]
    .filter(Boolean)
    .join(" ") || "Не указано";

const notifyOwnerAboutLead = async (env, message, text) => {
  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram owner chat is not configured");
  }

  const sender = message.from || {};
  const name = getSenderName(sender, message.contact);
  const phone = message.contact?.phone_number || "Не указан";
  const username = sender.username ? `@${sender.username}` : "Не указан";
  const lines = [
    "<b>🔥 Новый лид из Telegram-бота Neura!</b>",
    "",
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Телефон:</b> ${escapeHtml(phone)}`,
    `<b>Username:</b> ${escapeHtml(username)}`,
    `<b>Сообщение:</b> ${escapeHtml(
      (text || "Поделился(лась) контактом").slice(0, MAX_MESSAGE_LENGTH),
    )}`,
  ];

  await sendBotMessage(env, env.TELEGRAM_CHAT_ID, lines.join("\n"), {
    parse_mode: "HTML",
  });
};

const hasPhoneNumber = (text) =>
  /(?:^|[\s(])(?:\+?\d[\d\s().-]{7,}\d)(?:$|[\s),.!?])/u.test(text);

const isOrderRequest = (text) =>
  /заказ|заказать|хочу\s+(?:купить|заказать|сайт|бот)|оформить|оставить\s+заявк|связаться|нужен\s+(?:сайт|лендинг|бот)|сделать\s+(?:сайт|лендинг)|создать\s+(?:сайт|лендинг)|разработ(?:ать|ка)/iu.test(
    text,
  );

const getGigaChatAnswer = async (env, question) => {
  const authKey = (env.GIGACHAT_AUTH_KEY || "").trim();
  if (!authKey) return null;

  let requestStage = "token";
  let httpStatus = null;
  try {
    const tokenResponse = await fetch(
      "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          RqUID: crypto.randomUUID(),
        },
        body: "scope=GIGACHAT_API_PERS",
        signal: AbortSignal.timeout(10000),
      },
    );
    httpStatus = tokenResponse.status;
    if (httpStatus !== 200) {
      const errorText = await tokenResponse.text();
      throw new Error(
        errorText || `GigaChat token request returned HTTP ${httpStatus}`,
      );
    }

    const tokenResult = await tokenResponse.json();
    if (typeof tokenResult.access_token !== "string" || !tokenResult.access_token) {
      throw new Error("GigaChat token response did not contain an access token");
    }

    requestStage = "chat";
    httpStatus = null;
    const chatResponse = await fetch(
      "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "GigaChat",
          messages: [
            { role: "system", content: GIGACHAT_SYSTEM_PROMPT },
            { role: "user", content: question },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    httpStatus = chatResponse.status;
    if (httpStatus !== 200) {
      const errorText = await chatResponse.text();
      throw new Error(
        errorText || `GigaChat completion returned HTTP ${httpStatus}`,
      );
    }

    const chatResult = await chatResponse.json();
    const answer = chatResult.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("GigaChat response did not contain an answer");
    }
    return answer.trim().slice(0, 4000);
  } catch (error) {
    console.error("GigaChat request failed", error);
    const errorText =
      error instanceof Error ? error.message : String(error);
    const endpoint =
      requestStage === "token"
        ? "ngw.devices.sberbank.ru"
        : "gigachat.devices.sberbank.ru";
    const diagnostic = `GigaChat ${requestStage} error (${endpoint}); HTTP ${
      httpStatus ?? "status unavailable"
    }: ${errorText}`;
    try {
      await sendBotMessage(env, env.TELEGRAM_CHAT_ID, diagnostic);
    } catch (notificationError) {
      console.error("Could not notify owner about GigaChat error", notificationError);
    }
    return null;
  }
};

const handleTelegramWebhook = async (request, env) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("Expected application/json", 415);
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.error("Telegram bot token is not configured");
    return errorResponse("Telegram bot is not configured", 500);
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }
  if (!update || typeof update !== "object" || Array.isArray(update)) {
    return errorResponse("Invalid request body", 400);
  }

  try {
    const callback = update.callback_query;
    if (callback?.data === "order_request" && callback.message?.chat?.id) {
      await telegramApi(env, "answerCallbackQuery", {
        callback_query_id: callback.id,
      });
      await sendBotMessage(
        env,
        callback.message.chat.id,
        "С удовольствием поможем! Напишите номер телефона или ваш @username — руководитель студии свяжется с вами для бесплатного расчёта.",
        { reply_markup: TELEGRAM_REPLY_KEYBOARD },
      );
      return jsonResponse({ ok: true });
    }

    const message = update.message;
    if (!message?.chat?.id) return jsonResponse({ ok: true });

    const chatId = message.chat.id;
    const text = typeof message.text === "string" ? message.text.trim() : "";
    if (/^\/start(?:@\w+)?(?:\s|$)/u.test(text)) {
      await sendBotMessage(env, chatId, TELEGRAM_START_TEXT, {
        reply_markup: TELEGRAM_REPLY_KEYBOARD,
      });
    } else if (text === "💎 Тарифы и сроки") {
      await sendBotMessage(
        env,
        chatId,
        "💎 Тарифы и сроки Neura:\n\n1. Продающий лендинг под ключ — 15 000 ₽, срок 1–3 дня.\n2. Лендинг + ИИ-чат-бот — 22 000 ₽, срок 2–4 дня.\n3. Комплекс: сайт + чат-бот + ИИ-агент — 30 000 ₽, срок 3–5 дней.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Хочу заказать", callback_data: "order_request" }],
            ],
          },
        },
      );
    } else if (text === "🤖 Что такое ИИ-агент?") {
      await sendBotMessage(
        env,
        chatId,
        "ИИ-агент — это виртуальный сотрудник, который работает 24/7: сам консультирует клиентов, помогает записывать их и экономит до 3–4 часов рутины в день.",
      );
    } else if (text === "🌐 Наш сайт") {
      await sendBotMessage(
        env,
        chatId,
        "🌐 Сайт студии Neura: https://neura-site.olyshka21-07-1971.workers.dev",
      );
    } else if (
      message.contact ||
      (text &&
        (hasPhoneNumber(text) ||
          isOrderRequest(text) ||
          /(?:^|\s)@[a-zA-Z0-9_]{5,32}\b/u.test(text)))
    ) {
      await notifyOwnerAboutLead(env, message, text);
      await sendBotMessage(
        env,
        chatId,
        "Спасибо! Ваша заявка передана руководителю студии Ольге, скоро свяжемся с вами",
        { reply_markup: TELEGRAM_REPLY_KEYBOARD },
      );
    } else if (text) {
      const answer = await getGigaChatAnswer(env, text);
      await sendBotMessage(env, chatId, answer || TELEGRAM_BOT_FALLBACK, {
        reply_markup: TELEGRAM_REPLY_KEYBOARD,
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Telegram webhook handling failed", error);
    return errorResponse("Could not process Telegram update", 502);
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/send-telegram" && request.method === "POST") {
      return sendTelegramMessage(request, env);
    }
    if (url.pathname === "/api/telegram-webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
