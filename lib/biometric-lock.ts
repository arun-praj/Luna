"use client";

const BIOMETRIC_ENABLED_KEY = "cocomelon.biometric-lock-enabled";
const BIOMETRIC_CREDENTIAL_KEY = "cocomelon.biometric-lock-credential";
const BIOMETRIC_USER_KEY = "cocomelon.biometric-lock-user";

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomChallenge() {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

export function isBiometricLockEnabled(userId?: string) {
  const enabled = window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
  const credential = window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  const registeredUserId = window.localStorage.getItem(BIOMETRIC_USER_KEY);
  return enabled && Boolean(credential) && (!userId || registeredUserId === userId);
}

export function disableBiometricLock() {
  window.localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  window.localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  window.localStorage.removeItem(BIOMETRIC_USER_KEY);
}

export function clearBiometricLockForDifferentUser(userId: string) {
  const registeredUserId = window.localStorage.getItem(BIOMETRIC_USER_KEY);
  const hasStoredLock = window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true" || Boolean(window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY));
  if (hasStoredLock && registeredUserId !== userId) disableBiometricLock();
}

export function canUseBiometricLock() {
  return typeof window !== "undefined" && window.isSecureContext && "PublicKeyCredential" in window && typeof navigator !== "undefined" && Boolean(navigator.credentials);
}

export async function isBiometricPlatformAvailable() {
  if (!canUseBiometricLock()) return false;
  const credentialApi = window.PublicKeyCredential;
  if (typeof credentialApi.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
  try {
    return await credentialApi.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function biometricErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "This browser or device did not allow biometric setup. Use HTTPS or localhost, enable a screen lock, or try Chrome/Samsung Internet outside an in-app browser.";
  }
  return error instanceof Error ? error.message : "Could not enable biometric unlock.";
}

export async function enableBiometricLock(user: { id: string; name: string; email: string }) {
  if (!(await isBiometricPlatformAvailable())) throw new Error("Fingerprint or device biometric unlock is not available here. Try HTTPS or localhost in a supported browser with a screen lock enabled.");
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "Luna" },
      user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.name || user.email },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      timeout: 60_000,
      attestation: "none",
    },
  });
  if (!(credential instanceof PublicKeyCredential)) throw new Error("Could not create a device unlock credential.");
  window.localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, bytesToBase64Url(credential.rawId));
  window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
  window.localStorage.setItem(BIOMETRIC_USER_KEY, user.id);
}

export async function unlockWithBiometric() {
  if (!canUseBiometricLock()) throw new Error("Biometric unlock is not available in this browser or context.");
  const storedCredential = window.localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!storedCredential) throw new Error("No biometric credential is registered on this device.");
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ id: base64UrlToBytes(storedCredential), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return credential instanceof PublicKeyCredential;
}

export { biometricErrorMessage };
