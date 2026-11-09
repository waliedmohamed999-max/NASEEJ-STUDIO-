export function SceneFallback() {
  return (
    <div className="flex size-full items-center justify-center" role="status" aria-label="Loading">
      <div className="size-10 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}
