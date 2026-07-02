// Non-goal: multi-agent concurrency. This serial queue is a *degenerate
// scheduler* — it imposes a global order the application has no basis to
// choose. Deliberately best-effort, not a TODO: it is a measured wall
// (latency grows linearly with concurrency). See docs/18 §4 and paper §3.1.
// The fix belongs one layer down (semantics-aware agent scheduling), not here.

type Task<T> = () => Promise<T>;

const queues = new Map<string, Promise<unknown>>();

export function enqueue<T>(key: string, task: Task<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(key, next);
  next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}
