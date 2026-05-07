const BOT_TOKEN = process.env.BOT_TOKEN;
const DOWNLOAD_LINK = process.env.DOWNLOAD_LINK;
const MOVIE_TITLE = process.env.MOVIE_TITLE || "Official Download Access";
const STAR_PRICE = Number(process.env.STAR_PRICE || 250);
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PHOTO_URL = process.env.PHOTO_URL;

async function telegram(method, data) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const json = await res.json();

  if (!json.ok) {
    console.error("Telegram API error:", method, JSON.stringify(json));
    throw new Error(`${method}: ${json.description}`);
  }

  return json;
}

async function sendPrivateInvoice(chatId) {
  const invoice = {
    chat_id: chatId,
    title: MOVIE_TITLE,
    description: "Purchase instant download access to the full movie in high quality.",
    payload: "movie_download_access_001",
    currency: "XTR",
    prices: [
      {
        label: "Download Access",
        amount: STAR_PRICE
      }
    ],
    start_parameter: "buy"
  };

  if (PHOTO_URL) {
    invoice.photo_url = PHOTO_URL;
    invoice.photo_width = 1536;
    invoice.photo_height = 857;
  }

  await telegram("sendInvoice", invoice);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram Stars bot is running.");
  }

  const secret = req.headers["x-telegram-bot-api-secret-token"];

  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(403).send("Forbidden");
  }

  const update = req.body;

  try {
    const text = update.message?.text;
    const chatId = update.message?.chat?.id;

    // Social media bio link opens bot with: /start buy
    if (text === "/start buy" || text === "/buy" || text === "buy") {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `🎬 ${MOVIE_TITLE}\n\n` +
          `You’re one step away from instant download access.\n\n` +
          `Tap Pay below to unlock the movie with Telegram Stars.`
      });

      await sendPrivateInvoice(chatId);

      return res.status(200).json({ ok: true });
    }

    // Normal /start fallback
    if (text === "/start") {
      await telegram("sendMessage", {
        chat_id: chatId,
        text:
          `🎬 ${MOVIE_TITLE}\n\n` +
          `Tap below to purchase official download access with Telegram Stars.`,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `Unlock Download ⭐ ${STAR_PRICE}`,
                callback_data: "buy_download"
              }
            ]
          ]
        }
      });

      return res.status(200).json({ ok: true });
    }

    // User taps manual unlock button
    if (update.callback_query?.data === "buy_download") {
      const privateChatId = update.callback_query.message.chat.id;

      await telegram("answerCallbackQuery", {
        callback_query_id: update.callback_query.id
      });

      await sendPrivateInvoice(privateChatId);

      return res.status(200).json({ ok: true });
    }

    // Required before payment completes
    if (update.pre_checkout_query) {
      await telegram("answerPreCheckoutQuery", {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true
      });

      return res.status(200).json({ ok: true });
    }

    // After successful payment, deliver download privately
    if (update.message?.successful_payment) {
      const buyerChatId = update.message.chat.id;

      await telegram("sendMessage", {
        chat_id: buyerChatId,
        text:
          `✅ Payment received.\n\n` +
          `Here is your official movie download access:\n\n` +
          `${DOWNLOAD_LINK}\n\n` +
          `Save this link now.`
      });

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Bot error:", err.message);

    if (update.message?.chat?.id) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
          text: `❌ Error: ${err.message}`
        })
      });
    }

    return res.status(200).json({ ok: false, error: err.message });
  }
}
