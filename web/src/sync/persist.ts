/*
 * Requests persistent storage (architecture.md AR-21). iOS Safari can evict
 * the cache + outbox under storage pressure; persistence makes that less
 * likely once granted. Fire-and-forget on every device — it no-ops when
 * `navigator.storage.persist` is missing.
 *
 * Defensive: Safari has been observed to reject this promise in some
 * private-window contexts; we never let that reject propagate.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false;
  }
  try {
    const granted = await navigator.storage.persist();
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'storage-persist',
        granted,
      }),
    );
    return granted;
  } catch {
    return false;
  }
}
