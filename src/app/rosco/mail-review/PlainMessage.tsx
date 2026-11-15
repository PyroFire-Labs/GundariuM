/** Email is always a React text child: never HTML, links, or executable instructions. */
export function PlainMessage({ text }: { text: string }) {
  return (
    <pre dir="auto" className="whitespace-pre-wrap break-words rounded-lg bg-[var(--background)] p-4 font-mono text-sm [overflow-wrap:anywhere]">
      {text}
    </pre>
  );
}
