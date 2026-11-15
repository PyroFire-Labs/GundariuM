export function formatReceivedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown received time"
    : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function messageText(message: { text: string | null; htmlOnly: boolean }): string {
  if (message.text) return message.text;
  return message.htmlOnly
    ? "This message contains HTML only. HTML is not displayed."
    : "This message has no plain-text content.";
}

export function reviewFailure(status: number): "unauthorized" | "missing" | "error" {
  if (status === 401 || status === 403) return "unauthorized";
  return status === 404 ? "missing" : "error";
}
