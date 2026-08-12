export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
// Keep a worst-case import bounded to roughly 50 D1 batches. Larger backups
// should be exported in smaller slices rather than monopolising a Worker.
export const MAX_IMPORT_RECORDS = 5_000;
export const IMPORT_BATCH_SIZE = 100;
