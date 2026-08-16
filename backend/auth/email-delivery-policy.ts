export type VerificationEmailDeliveryStatus =
  | "sent"
  | "queued"
  | "failed"
  | "unavailable";

type DeliveryExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type Cleanup = () => Promise<unknown>;

async function runCleanup(cleanup: Cleanup | undefined) {
  if (!cleanup) return;
  try {
    await cleanup();
  } catch {
    // A failed cleanup must not create an unhandled rejection. The next
    // resend replaces the code, and scheduled maintenance removes expired
    // records.
  }
}

export async function executeVerificationEmailDelivery({
  send,
  context,
  onFailure,
}: {
  send: () => Promise<unknown>;
  context: DeliveryExecutionContext | null;
  onFailure?: Cleanup;
}): Promise<Exclude<VerificationEmailDeliveryStatus, "unavailable">> {
  if (context) {
    context.waitUntil(
      send().catch(async () => {
        await runCleanup(onFailure);
      }),
    );
    return "queued";
  }

  try {
    await send();
    return "sent";
  } catch {
    await runCleanup(onFailure);
    return "failed";
  }
}

export function verificationEmailResponse(status: VerificationEmailDeliveryStatus) {
  return {
    verificationEmailSent: status === "sent",
    verificationEmailQueued: status === "queued",
    verificationEmailDelivery: status,
  };
}
