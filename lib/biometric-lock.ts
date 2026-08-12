"use client";

import { clearBiometricLockRegistration, readBiometricLockRegistration, writeBiometricLockRegistration } from "@/lib/biometric-lock-storage";

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

export async function isBiometricLockEnabled(userId?: string) {
  const registration = await readBiometricLockRegistration();
  return Boolean(registration?.credentialId && (!userId || registration.userId === userId));
}

export async function disableBiometricLock() {
  await clearBiometricLockRegistration();
}

export async function clearBiometricLockForDifferentUser(userId: string) {
  const registration = await readBiometricLockRegistration();
  if (registration && registration.userId !== userId) await disableBiometricLock();
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
  await writeBiometricLockRegistration({ userId: user.id, credentialId: bytesToBase64Url(credential.rawId) });
}

export async function unlockWithBiometric() {
  if (!canUseBiometricLock()) throw new Error("Biometric unlock is not available in this browser or context.");
  const registration = await readBiometricLockRegistration();
  if (!registration?.credentialId) throw new Error("No biometric credential is registered on this device.");
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{ id: base64UrlToBytes(registration.credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return credential instanceof PublicKeyCredential;
}

export { biometricErrorMessage };
