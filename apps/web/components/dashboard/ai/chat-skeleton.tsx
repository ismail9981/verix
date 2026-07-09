/* Loading skeleton for the chat layout: a sidebar column and a message
   area. Shimmers via animate-pulse; aria-hidden since it conveys no content. */
export function ChatSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid animate-pulse gap-6 lg:grid-cols-[260px_1fr]"
    >
      <div className="hidden h-[600px] flex-col gap-3 rounded-2xl border border-hairline bg-surface/40 p-4 lg:flex">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-10 w-full rounded-lg bg-hairline" />
        ))}
      </div>
      <div className="flex h-[560px] flex-col gap-4 rounded-2xl border border-hairline bg-surface/40 p-6 lg:h-[600px]">
        <span className="h-14 w-2/3 rounded-2xl bg-hairline" />
        <span className="h-20 w-4/5 self-end rounded-2xl bg-hairline" />
        <span className="h-16 w-3/5 rounded-2xl bg-hairline" />
        <span className="mt-auto h-12 w-full rounded-xl bg-hairline" />
      </div>
    </div>
  );
}
