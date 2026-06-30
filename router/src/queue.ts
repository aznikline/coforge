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
