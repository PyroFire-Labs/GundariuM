const TELEGRAM_API = "https://api.telegram.org";

export async function sendAlert(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚨 <b>GundariuM</b>\n${message}`,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("sendAlert: Telegram delivery failed:", err);
  }
}
