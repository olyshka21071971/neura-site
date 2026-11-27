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
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" },
  );
  document.documentElement.classList.add("js");
  revealElements.forEach((element) => {
    revealObserver.observe(element);
  });
} else {
  revealElements.forEach((element) => element.classList.add("visible"));
}

const faqList = document.querySelector(".faq-list");
faqList?.addEventListener("click", (event) => {
  const button = event.target.closest(".faq-question");
  if (!button) return;

  const shouldExpand = button.getAttribute("aria-expanded") !== "true";
  faqList.querySelectorAll(".faq-question").forEach((question) => {
    const isExpanded = question === button && shouldExpand;
    question.setAttribute("aria-expanded", String(isExpanded));
    document
      .getElementById(question.getAttribute("aria-controls"))
      ?.setAttribute("aria-hidden", String(!isExpanded));
  });
});

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

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok || !result || result.ok !== true) {
    throw new Error(result?.error || "Не удалось отправить заявку.");
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
    console.error("Не удалось отправить заявку:", error.message);
    showToast("Не удалось отправить заявку. Попробуйте еще раз позже.");
  } finally {
    submitButton.disabled = false;
    contactForm.removeAttribute("aria-busy");
  }
});

const leadMagnetForm = document.getElementById("lead-magnet-form");

leadMagnetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!leadMagnetForm.reportValidity()) return;
  if (honeypotValue(leadMagnetForm) !== "") return;
  if (!canSubmit("lead-magnet-form")) {
    showToast("Пожалуйста, подождите 30 секунд перед повторной отправкой.");
    return;
  }

  const formData = new FormData(leadMagnetForm);
  const submitButton = leadMagnetForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  leadMagnetForm.setAttribute("aria-busy", "true");
  showToast("Отправляем запрос на подарок...");
  try {
    await sendLead({
      name: "Лид-магнит с сайта",
      contact: formData.get("contact").trim(),
      message: "Лид-магнит: чек-лист «7 ошибок сайта и Telegram» и бесплатный прототип первого экрана за 24 часа.",
    });
    recordSubmit("lead-magnet-form");
    showToast("Запрос отправлен — скоро свяжемся с вами");
    leadMagnetForm.reset();
  } catch (error) {
    console.error("Не удалось отправить запрос на лид-магнит:", error.message);
    showToast("Не удалось отправить запрос. Попробуйте еще раз позже.");
  } finally {
    submitButton.disabled = false;
    leadMagnetForm.removeAttribute("aria-busy");
  }
});

const quizForm = document.getElementById("quiz-form");
const quizSteps = [...quizForm.querySelectorAll("[data-quiz-step]")];
const quizBackButton = document.getElementById("quiz-back");
const quizNextButton = document.getElementById("quiz-next");
const quizStepLabel = document.getElementById("quiz-step-label");
const quizProgressPercent = document.getElementById("quiz-progress-percent");
const quizProgressTrack = document.getElementById("quiz-progress-track");
const quizProgressFill = document.getElementById("quiz-progress-fill");
const quizTotal = document.getElementById("quiz-total");
const quizDuration = document.getElementById("quiz-duration");
const quizSummaryList = document.getElementById("quiz-summary-list");
const rubleFormatter = new Intl.NumberFormat("ru-RU");
let currentQuizStep = 1;

const formatRubles = (amount) => `${rubleFormatter.format(amount)} ₽`;

const getQuizSelection = () => {
  const project = quizForm.querySelector('input[name="project"]:checked');
  const modules = [
    ...quizForm.querySelectorAll('input[name="module"]:checked'),
  ];
  const urgency = quizForm.querySelector('input[name="urgency"]:checked');
  const basePrice = Number(project.dataset.price);
  const modulePrice = modules.reduce(
    (total, module) => total + Number(module.dataset.price),
    0,
  );
  const subtotal = basePrice + modulePrice;
  const percent = Number(urgency.dataset.percent);
  const total = Math.round(subtotal * (1 + percent / 100));

  return {
    project,
    modules,
    urgency,
    subtotal,
    total,
    rushFee: total - subtotal,
    duration:
      percent > 0
        ? "Ориентировочный срок: до 24 часов"
        : `Ориентировочный срок: ${project.dataset.duration}`,
  };
};

const addQuizSummaryRow = (label, price) => {
  const item = document.createElement("li");
  const title = document.createElement("span");
  const amount = document.createElement("span");
  title.textContent = label;
  amount.textContent = price;
  item.append(title, amount);
  quizSummaryList.append(item);
};

const renderQuizResult = () => {
  const selection = getQuizSelection();
  quizTotal.textContent = formatRubles(selection.total);
  quizDuration.textContent = selection.duration;
  quizSummaryList.replaceChildren();
  addQuizSummaryRow(
    selection.project.value,
    formatRubles(Number(selection.project.dataset.price)),
  );
  if (selection.modules.length) {
    selection.modules.forEach((module) => {
      const price = Number(module.dataset.price);
      addQuizSummaryRow(
        module.value,
        price === 0 ? "Бесплатно" : `+${formatRubles(price)}`,
      );
    });
  } else {
    addQuizSummaryRow("Дополнительные модули не выбраны", "—");
  }
  addQuizSummaryRow(
    selection.urgency.value,
    selection.rushFee > 0 ? `+${formatRubles(selection.rushFee)}` : "Без доплаты",
  );
};

const updateQuizStep = () => {
  quizSteps.forEach((step) => {
    step.hidden = Number(step.dataset.quizStep) !== currentQuizStep;
  });
  const progress = (currentQuizStep / quizSteps.length) * 100;
  quizStepLabel.textContent = `Шаг ${currentQuizStep} из ${quizSteps.length}`;
  quizProgressPercent.textContent = `${progress}%`;
  quizProgressTrack.setAttribute("aria-valuenow", String(currentQuizStep));
  quizProgressFill.style.width = `${progress}%`;
  quizBackButton.disabled = currentQuizStep === 1;
  quizNextButton.hidden = currentQuizStep === quizSteps.length;

  if (currentQuizStep === quizSteps.length) {
    renderQuizResult();
  }
};

const canContinueQuiz = () => {
  if (currentQuizStep === 1) {
    return Boolean(quizForm.querySelector('input[name="project"]:checked'));
  }
  if (currentQuizStep === 3) {
    return Boolean(quizForm.querySelector('input[name="urgency"]:checked'));
  }
  return true;
};

quizForm.addEventListener("change", () => {
  quizNextButton.disabled = !canContinueQuiz();
});

quizNextButton.addEventListener("click", () => {
  if (!canContinueQuiz()) {
    showToast(
      currentQuizStep === 1
        ? "Выберите, что будем разрабатывать."
        : "Выберите срок запуска.",
    );
    return;
  }
  currentQuizStep = Math.min(currentQuizStep + 1, quizSteps.length);
  updateQuizStep();
});

quizBackButton.addEventListener("click", () => {
  currentQuizStep = Math.max(currentQuizStep - 1, 1);
  updateQuizStep();
});

quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!quizForm.reportValidity()) return;

  if (!canSubmit("quiz-form")) {
    showToast("Пожалуйста, подождите 30 секунд перед повторной отправкой.");
    return;
  }

  const selection = getQuizSelection();
  const formData = new FormData(quizForm);
  const submitButton = quizForm.querySelector('button[type="submit"]');
  const selectedItems = [
    `${selection.project.value} — ${formatRubles(Number(selection.project.dataset.price))}`,
    ...selection.modules.map((module) => {
      const price = Number(module.dataset.price);
      return `${module.value} — ${price ? `+${formatRubles(price)}` : "бесплатно"}`;
    }),
    `${selection.urgency.value}${selection.rushFee ? ` — доплата ${formatRubles(selection.rushFee)}` : ""}`,
  ];
  const message = [
    "Расчёт проекта:",
    ...selectedItems.map((item) => `• ${item}`),
    `Итоговая стоимость: ${formatRubles(selection.total)}`,
    selection.duration,
  ].join("\n");

  submitButton.disabled = true;
  quizForm.setAttribute("aria-busy", "true");
  showToast("Отправляем расчёт...");
  try {
    await sendLead({
      name: formData.get("client-name").trim(),
      contact: formData.get("client-contact").trim(),
      tariff: selection.project.value,
      message,
    });
    recordSubmit("quiz-form");
    showToast("Расчёт отправлен — скоро свяжемся с вами");
    quizForm.reset();
    currentQuizStep = 1;
    updateQuizStep();
    quizNextButton.disabled = true;
  } catch (error) {
    console.error("Не удалось отправить расчёт:", error.message);
    showToast("Не удалось отправить расчёт. Попробуйте еще раз позже.");
  } finally {
    submitButton.disabled = false;
    quizForm.removeAttribute("aria-busy");
  }
});

updateQuizStep();
quizNextButton.disabled = true;

const chatWidget = document.querySelector(".chat-widget");
const chatLauncher = document.getElementById("chat-launcher");
const chatPanel = document.getElementById("chat-panel");
const chatClose = document.getElementById("chat-close");
const chatMessages = document.getElementById("chat-messages");
const chatQuickReplies = chatMessages.querySelector(".chat-quick-replies");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const assistantBadge = document.getElementById("assistant-badge");
const assistantCard = document.getElementById("assistant-card");
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
      console.error("Не удалось отправить заявку:", error.message);
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

const openAssistantChat = () => {
  setChatOpen(true);
};

assistantBadge?.addEventListener("click", openAssistantChat);
assistantCard?.addEventListener("click", openAssistantChat);

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
