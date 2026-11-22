const navToggle = document.getElementById("nav-toggle");
const navList = document.getElementById("nav-list");
const header = document.getElementById("header");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("open");
  navToggle.classList.toggle("active", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  document.body.classList.toggle("menu-open", isOpen);
});

document.querySelectorAll(".nav-list a").forEach((link) => {
  link.addEventListener("click", () => {
    navList.classList.remove("open");
    navToggle.classList.remove("active");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
  });
});

const updateHeader = () =>
  header.classList.toggle("scrolled", window.scrollY > 36);
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    if (!targetId || targetId === "#") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.querySelector(targetId);
    if (target) {
      event.preventDefault();
      const offset = header.offsetHeight + 18;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  });
});

const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealTimers = new Map();
  const showRevealElement = (element, observer) => {
    window.clearTimeout(revealTimers.get(element));
    element.classList.add("visible");
    observer.unobserve(element);
    revealTimers.delete(element);
  };
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          showRevealElement(entry.target, observer);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" },
  );
  document.documentElement.classList.add("js");
  revealElements.forEach((element) => {
    revealObserver.observe(element);
    revealTimers.set(
      element,
      window.setTimeout(() => showRevealElement(element, revealObserver), 2500),
    );
  });
} else {
  revealElements.forEach((element) => element.classList.add("visible"));
}

const contactForm = document.getElementById("contact-form");
const toast = document.getElementById("toast");

const RATE_LIMIT_MS = 30 * 1000;
const lastSubmit = new Map();

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 4200);
};

const honeypotValue = (form) => {
  const field = form.querySelector(
    'input[name="website"], textarea[name="website"]',
  );
  return field ? field.value.trim() : "";
};

const canSubmit = (formId) => {
  const now = Date.now();
  const last = lastSubmit.get(formId) || 0;
  if (now - last < RATE_LIMIT_MS) return false;
  return true;
};

const recordSubmit = (formId) => {
  lastSubmit.set(formId, Date.now());
};

const sendLead = async (lead) => {
  const response = await fetch("/api/send-telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!response.ok) {
    throw new Error("Не удалось отправить заявку.");
  }
};

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (honeypotValue(contactForm) !== "") {
    return;
  }
  if (!canSubmit("contact-form")) {
    showToast("Пожалуйста, подождите 30 секунд перед повторной отправкой.");
    return;
  }
  const formData = new FormData(contactForm);
  const submitButton = contactForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  contactForm.setAttribute("aria-busy", "true");
  showToast("Отправляем заявку...");
  try {
    await sendLead({
      name: formData.get("name").trim(),
      contact: formData.get("phone").trim(),
      message: formData.get("message").trim(),
    });
    recordSubmit("contact-form");
    showToast("Заявка отправлена — скоро свяжемся с вами");
    contactForm.reset();
  } catch (error) {
    console.error(error);
    showToast("Не удалось отправить заявку. Попробуйте еще раз позже.");
  } finally {
    submitButton.disabled = false;
    contactForm.removeAttribute("aria-busy");
  }
});

const chatWidget = document.querySelector(".chat-widget");
const chatLauncher = document.getElementById("chat-launcher");
const chatPanel = document.getElementById("chat-panel");
const chatClose = document.getElementById("chat-close");
const chatMessages = document.getElementById("chat-messages");
const chatQuickReplies = chatMessages.querySelector(".chat-quick-replies");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const assistantBadge = document.getElementById("assistant-badge");
let chatLead = null;
let chatLeadSubmitting = false;

const chatReplies = {
  "Узнать стоимость":
    "Актуальные цены: лендинг под ключ — от 15 000 ₽; лендинг с уникальным дизайном и адаптацией — от 25 000 ₽; чат-бот для сайта или Telegram — от 15 000 ₽; умный ИИ-бот / агент с нейросетью для продаж и консультаций — от 30 000 ₽.",
  "Сроки создания":
    "Лендинг под ключ создается за 1–3 дня. Лендинг с чат-ботом или ИИ-агентом — за 2–4 дня.",
};

const setChatOpen = (isOpen) => {
  chatPanel.hidden = !isOpen;
  chatPanel.setAttribute("aria-hidden", String(!isOpen));
  chatLauncher.setAttribute("aria-expanded", String(isOpen));
  chatLauncher.setAttribute(
    "aria-label",
    isOpen
      ? "Закрыть чат с помощником Neura"
      : "Открыть чат с помощником Neura",
  );
  chatWidget.classList.toggle("is-open", isOpen);
  if (isOpen) {
    chatInput.focus();
  } else {
    chatLauncher.focus();
  }
};

const appendChatMessage = (text, sender, includeContactLink = false) => {
  const message = document.createElement("div");
  message.className = `chat-message ${sender}`;
  message.textContent = text;

  if (includeContactLink) {
    const link = document.createElement("a");
    link.className = "chat-contact-link";
    link.href = "#contact";
    link.textContent = " Перейти к форме";
    message.append(link);
  }

  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
};

const startLeadCollection = (contact = "") => {
  chatLead = { stage: "name", contact };
  chatQuickReplies.hidden = true;
  appendChatMessage(
    contact ? "Контакт получил. Как вас зовут?" : "С удовольствием! Как вас зовут?",
    "assistant",
  );
};

const sendChatQuestion = async (question) => {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || chatLeadSubmitting) return;

  appendChatMessage(cleanQuestion, "user");
  if (chatLead) {
    if (chatLead.stage === "name") {
      if (cleanQuestion.length > 120) {
        appendChatMessage("Имя должно быть не длиннее 120 символов. Попробуйте еще раз.", "assistant");
        return;
      }
      chatLead.name = cleanQuestion;
      if (chatLead.contact) {
        chatLead.stage = "message";
        appendChatMessage("Кратко опишите задачу или выбранный тариф.", "assistant");
        return;
      }
      chatLead.stage = "contact";
      appendChatMessage("Спасибо! Теперь укажите телефон, email или Telegram для связи.", "assistant");
      return;
    }

    if (chatLead.stage === "contact") {
      if (cleanQuestion.length > 200) {
        appendChatMessage("Контакт должен быть не длиннее 200 символов. Попробуйте еще раз.", "assistant");
        return;
      }
      chatLead.contact = cleanQuestion;
      chatLead.stage = "message";
      appendChatMessage("Кратко опишите задачу или выбранный тариф.", "assistant");
      return;
    }

    if (cleanQuestion.length > 2000) {
      appendChatMessage("Описание должно быть не длиннее 2000 символов. Сократите его и отправьте еще раз.", "assistant");
      return;
    }

    chatLead.message = cleanQuestion;
    if (!canSubmit("chat-lead")) {
      appendChatMessage("Пожалуйста, подождите 30 секунд перед повторной отправкой заявки.", "assistant");
      return;
    }
    chatLeadSubmitting = true;
    chatForm.querySelector('button[type="submit"]').disabled = true;
    const deliveryStatus = appendChatMessage("Отправляем заявку...", "assistant");
    try {
      await sendLead({
        name: chatLead.name,
        contact: chatLead.contact,
        message: chatLead.message,
      });
      recordSubmit("chat-lead");
      deliveryStatus.textContent = "Заявка отправлена! Команда Neura свяжется с вами в течение одного рабочего дня.";
      chatLead = null;
      chatQuickReplies.hidden = false;
    } catch (error) {
      console.error(error);
      chatLead.stage = "message";
      deliveryStatus.textContent = "Не удалось отправить заявку. Проверьте соединение и отправьте описание еще раз.";
    } finally {
      chatLeadSubmitting = false;
      chatForm.querySelector('button[type="submit"]').disabled = false;
    }
    return;
  }

  const normalized = cleanQuestion.toLowerCase();
  if (/(заявк|заказ|консультац|связаться|контакт)/i.test(normalized)) {
    startLeadCollection();
    return;
  }

  let reply = chatReplies[cleanQuestion];
  let includeContactLink = false;

  if (!reply && /(цен[аы]|стоимост|тариф|сколько стоит|бюджет)/i.test(normalized)) {
    reply = "Стоимость разработки от 15 000 до 30 000 ₽: лендинг и чат-бот — от 15 000 ₽, лендинг с уникальным дизайном — от 25 000 ₽, ИИ-ассистент или агент — от 30 000 ₽. Могу подобрать формат под вашу задачу.";
  } else if (
    !reply &&
    /(?:\+?7|8)[\d\s()-]{9,}|@[A-Za-z0-9_]{3,}/i.test(cleanQuestion)
  ) {
    startLeadCollection(cleanQuestion);
    return;
  } else if (!reply) {
    reply = "Спасибо за вопрос! Я могу рассчитать стоимость проектов от 15 000 до 30 000 ₽, рассказать о сроках и принять заявку на консультацию.";
    includeContactLink = true;
  }

  appendChatMessage(reply, "assistant", includeContactLink);
};

chatLauncher.addEventListener("click", () => {
  setChatOpen(chatPanel.hidden);
});

assistantBadge?.addEventListener("click", () => {
  setChatOpen(true);
});

chatClose.addEventListener("click", () => setChatOpen(false));

chatPanel.addEventListener("click", (event) => {
  const questionButton = event.target.closest("[data-question]");
  if (questionButton) {
    sendChatQuestion(questionButton.dataset.question);
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (honeypotValue(chatForm) !== "") {
    return;
  }
  const cleanQuestion = chatInput.value.trim();
  if (!cleanQuestion) return;
  await sendChatQuestion(cleanQuestion);
  chatForm.reset();
  chatInput.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatPanel.hidden) {
    setChatOpen(false);
  }
});
