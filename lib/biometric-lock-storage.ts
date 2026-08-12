"use client";

const DATABASE_NAME = "luna-security";
const DATABASE_VERSION = 1;
const STORE_NAME = "biometric-lock";
const RECORD_KEY = "registration";

export type BiometricLockRegistration = {
  userId: string;
  credentialId: string;
};

function clearLegacyRegistration() {
  try {
    window.localStorage.removeItem("cocomelon.biometric-lock-enabled");
    window.localStorage.removeItem("cocomelon.biometric-lock-credential");
    window.localStorage.removeItem("cocomelon.biometric-lock-user");
  } catch {
    // Storage may be disabled. IndexedDB remains the source of truth.
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function readBiometricLockRegistration(): Promise<BiometricLockRegistration | null> {
  const database = await openDatabase();
  if (!database) return null;
  const stored = await new Promise<BiometricLockRegistration | null>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve((request.result as BiometricLockRegistration | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
  database.close();
  if (stored?.userId && stored.credentialId) return stored;
  return null;
}

export async function writeBiometricLockRegistration(registration: BiometricLockRegistration): Promise<void> {
  const database = await openDatabase();
  if (!database) throw new Error("This browser cannot store biometric unlock settings.");
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(registration, RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save biometric unlock settings."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save biometric unlock settings."));
  });
  database.close();
  clearLegacyRegistration();
}

export async function clearBiometricLockRegistration(): Promise<void> {
  const database = await openDatabase();
  if (database) {
    await new Promise<void>((resolve) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
    database.close();
  }
  clearLegacyRegistration();
}
