const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
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
    console.error("Telegram API error:", method, json);
  }

  return json;
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
    // When you DM the bot /post, it posts the Stars invoice to your channel
    if (update.message?.text === "/post") {
      const chatId = update.message.chat.id;

      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Posting the Stars purchase message to your channel now..."
      });

      await telegram("sendInvoice", {
        chat_id: CHANNEL_ID,
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
        start_parameter: "movie-download-access",
        photo_url: PHOTO_URL,
        photo_width: 1280,
        photo_height: 720
      });

      return res.status(200).json({ ok: true });
    }

    // Telegram requires this before completing the payment
    if (update.pre_checkout_query) {
      await telegram("answerPreCheckoutQuery", {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true
      });

      return res.status(200).json({ ok: true });
    }

    // After successful payment, send the download link to the buyer
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
    console.error("Bot error:", err);
    return res.status(200).json({ ok: false, error: String(err) });
  }
}
