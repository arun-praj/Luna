export function requireConfiguredStorage<T>(bucket: T | null | undefined): T {
  if (!bucket) throw new Error("Object storage is unavailable");
  return bucket;
}
