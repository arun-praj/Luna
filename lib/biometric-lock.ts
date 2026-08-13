"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { clearBiometricLockRegistration, readBiometricLockRegistration, writeBiometricLockRegistration } from "@/lib/biometric-lock-storage";
import { getAccessToken, setAccessToken } from "@/lib/auth-client";

async function serverRequest(path: string, init: RequestInit = {}) {
  const token = getAccessToken();
  return fetch(path, { ...init, credentials: "include", headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" } });
}

export async function isBiometricLockEnabled(userId?: string) {
  const registration = await readBiometricLockRegistration();
  if (registration && userId && registration.userId !== userId) return false;
  try {
    const response = await serverRequest("/api/auth/webauthn/status");
    if (response.ok) {
      const result = (await response.json()) as { enabled?: boolean };
      return Boolean(result.enabled || registration?.credentialId);
    }
  } catch {
    // A local registration keeps the gate fail-closed while offline.
  }
  return Boolean(registration?.credentialId && (!userId || registration.userId === userId));
}

export async function disableBiometricLock() {
  const response = await serverRequest("/api/auth/webauthn", { method: "DELETE" });
  if (!response.ok) throw new Error(response.status === 401 ? "Fresh biometric verification is required before disabling biometric unlock." : "Could not disable biometric unlock.");
  await clearBiometricLockRegistration();
}

export async function clearBiometricLockForDifferentUser(userId: string) {
  const registration = await readBiometricLockRegistration();
  if (registration && registration.userId !== userId) await clearBiometricLockRegistration();
}

export function canUseBiometricLock() {
  return typeof window !== "undefined" && window.isSecureContext && "PublicKeyCredential" in window && typeof navigator !== "undefined" && Boolean(navigator.credentials);
}

export async function isBiometricPlatformAvailable() {
  if (!canUseBiometricLock()) return false;
  const credentialApi = window.PublicKeyCredential;
  if (typeof credentialApi.isUserVerifyingPlatformAuthenticatorAvailable !== "function") return false;
  try { return await credentialApi.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

function biometricErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "This browser or device did not allow biometric setup. Use HTTPS or localhost, enable a screen lock, or try Chrome/Samsung Internet outside an in-app browser.";
  return error instanceof Error ? error.message : "Could not enable biometric unlock.";
}

export async function enableBiometricLock(user: { id: string; name: string; email: string }) {
  if (!(await isBiometricPlatformAvailable())) throw new Error("Fingerprint or device biometric unlock is not available here. Try HTTPS or localhost in a supported browser with a screen lock enabled.");
  const optionsResponse = await serverRequest("/api/auth/webauthn/register/options", { method: "POST" });
  if (!optionsResponse.ok) throw new Error("Could not start secure biometric registration.");
  const response = await startRegistration({ optionsJSON: await optionsResponse.json() });
  const verifyResponse = await serverRequest("/api/auth/webauthn/register/verify", { method: "POST", body: JSON.stringify({ response, deviceLabel: "This device" }) });
  if (!verifyResponse.ok) throw new Error("Biometric registration could not be verified by Luna.");
  await writeBiometricLockRegistration({ userId: user.id, credentialId: response.id });
}

export async function unlockWithBiometric() {
  if (!canUseBiometricLock()) throw new Error("Biometric unlock is not available in this browser or context.");
  const registration = await readBiometricLockRegistration();
  if (!registration?.credentialId) throw new Error("No biometric credential is registered on this device.");
  const optionsResponse = await serverRequest("/api/auth/webauthn/authenticate/options", { method: "POST" });
  if (!optionsResponse.ok) throw new Error("Secure biometric unlock is unavailable. Sign in again or register this device.");
  const response = await startAuthentication({ optionsJSON: await optionsResponse.json() });
  const verifyResponse = await serverRequest("/api/auth/webauthn/authenticate/verify", { method: "POST", body: JSON.stringify({ response }) });
  const result = await verifyResponse.json().catch(() => ({})) as { accessToken?: string; error?: string };
  if (!verifyResponse.ok || !result.accessToken) throw new Error(result.error ?? "Biometric assertion could not be verified.");
  setAccessToken(result.accessToken);
  return true;
}

export { biometricErrorMessage };
