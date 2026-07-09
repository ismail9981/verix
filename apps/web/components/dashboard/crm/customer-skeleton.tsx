/* Loading skeletons for the customer table body. Rows shimmer via
   animate-pulse; aria-hidden since they convey no content. */
export function CustomerSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse divide-y divide-hairline">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-3.5">
          <span className="h-8 w-8 shrink-0 rounded-full bg-hairline" />
          <span className="h-3.5 w-36 rounded bg-hairline" />
          <span className="hidden h-3.5 w-28 rounded bg-hairline lg:block" />
          <span className="hidden h-3.5 w-20 rounded bg-hairline sm:block" />
          <span className="ml-auto h-5 w-16 rounded-full bg-hairline" />
        </div>
      ))}
    </div>
  );
}
