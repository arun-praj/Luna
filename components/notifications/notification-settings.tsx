"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronDown, CloudOff, LoaderCircle, Mail, Smartphone } from "lucide-react";
import {
  loadNotificationSettings,
  forgetNotificationSubscriptionSync,
  notificationPermission,
  pushNotificationsConfigured,
  reconcileNotificationSubscription,
  requestNotificationPermission,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/lib/notifications";
import { authenticatedFetch } from "@/lib/auth-client";

type Props = {
  userId: string;
  monthlyReportEnabled: boolean;
  onMonthlyReportChange: (enabled: boolean) => void;
};

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${checked ? "bg-primary" : "bg-border-strong"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function NotificationSettingsCard({ userId, monthlyReportEnabled, onMonthlyReportChange }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => notificationPermission());
  const [isEnabling, setIsEnabling] = useState(false);
  const [isFrequencyOpen, setIsFrequencyOpen] = useState(false);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [isSavingMonthlyReport, setIsSavingMonthlyReport] = useState(false);
  const [isSchedulingReportTest, setIsSchedulingReportTest] = useState(false);
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [message, setMessage] = useState("");
  const thresholdSaveTimer = useRef<number | null>(null);
  const settingsLoaded = settings !== null;

  useEffect(() => {
    void loadNotificationSettings(userId).then(async (loaded) => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      if (loaded.timezone !== timezone) {
        const result = await saveNotificationSettings(userId, { timezone });
        setSettings(result.settings);
        return;
      }
      setSettings(loaded);
    });
  }, [userId]);

  useEffect(() => {
    if (!settingsLoaded || permission !== "granted") return;
    let cancelled = false;

    void reconcileNotificationSubscription(userId).then((result) => {
      if (cancelled || !result.subscription) return;
      setIsCurrentDeviceSubscribed(true);
      if (!result.synced)
        setMessage("Background alerts are enabled on this device and will sync when you’re online.");
    }).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [permission, settingsLoaded, userId]);

  useEffect(() => {
    function refreshPermission() {
      setPermission(notificationPermission());
    }
    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", refreshPermission);
    return () => {
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", refreshPermission);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (thresholdSaveTimer.current !== null) {
        window.clearTimeout(thresholdSaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    function syncWhenOnline() {
      if (!settings) return;
      void saveNotificationSettings(userId, {
        goalMilestonesEnabled: settings.goalMilestonesEnabled,
        recurringDueEnabled: settings.recurringDueEnabled,
        recurringDueTime: settings.recurringDueTime,
        loanPaymentDueEnabled: settings.loanPaymentDueEnabled,
        recurringTransactionEnabled: settings.recurringTransactionEnabled,
        recurringTransactionTime: settings.recurringTransactionTime,
        timezone: settings.timezone,
        recurringTransactionFrequency: settings.recurringTransactionFrequency,
        lowBalanceEnabled: settings.lowBalanceEnabled,
        lowBalanceThreshold: settings.lowBalanceThreshold,
        pushSubscription: settings.pushSubscription,
      });
    }
    window.addEventListener("online", syncWhenOnline);
    return () => window.removeEventListener("online", syncWhenOnline);
  }, [settings, userId]);

  async function update(patch: Partial<NotificationSettings>) {
    if (!settings) return;
    const result = await saveNotificationSettings(userId, patch);
    setSettings(result.settings);
    setMessage(result.synced ? "Saved" : "Saved on this device; will sync when you’re online");
    window.setTimeout(() => setMessage(""), 3200);
  }

  async function updateMonthlyReport(value: boolean) {
    setIsSavingMonthlyReport(true);
    setMessage("");
    const response = await authenticatedFetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyReportEnabled: value }),
    });
    if (response.ok) {
      onMonthlyReportChange(value);
      setMessage(value ? "Monthly email reports enabled" : "Monthly email reports disabled");
    } else {
      setMessage("Could not update report preference");
    }
    setIsSavingMonthlyReport(false);
  }

  async function scheduleReportTest() {
    setIsSchedulingReportTest(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/reports/test", { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(response.ok ? "Test report scheduled. It should arrive in about 30–90 seconds." : result?.error ?? "Could not schedule the report test");
    } catch {
      setMessage("Could not reach the report delivery service.");
    } finally {
      setIsSchedulingReportTest(false);
    }
  }

  function scheduleThresholdSave(value: number | null) {
    if (thresholdSaveTimer.current !== null) {
      window.clearTimeout(thresholdSaveTimer.current);
    }
    thresholdSaveTimer.current = window.setTimeout(() => {
      thresholdSaveTimer.current = null;
      void confirmThreshold(value);
    }, 500);
  }

  async function confirmThreshold(value: number | null) {
    if (thresholdSaveTimer.current !== null) {
      window.clearTimeout(thresholdSaveTimer.current);
      thresholdSaveTimer.current = null;
    }
    setIsSavingThreshold(true);
    try {
      await update({ lowBalanceThreshold: value });
    } finally {
      setIsSavingThreshold(false);
    }
  }

  async function enableNotifications() {
    setIsEnabling(true);
    setMessage("");
    if (permission === "denied") {
      setMessage("Notifications are blocked. Open this site’s permissions from your browser or device settings, choose Allow, then try again.");
      setIsEnabling(false);
      return;
    }
    const nextPermission = await requestNotificationPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") {
      const result = await reconcileNotificationSubscription(userId);
      if (result.subscription) {
        setIsCurrentDeviceSubscribed(true);
        if (!result.synced) setMessage("Background alerts are enabled on this device and will sync when you’re online.");
      } else setMessage(pushNotificationsConfigured()
        ? "Background alerts could not be enabled. Check that this site is installed or open in a supported browser, then try again."
        : "Background alerts are not configured for this deployment yet. Add the VAPID public key, then reload Luna.");
    } else if (nextPermission === "denied") {
      setMessage("Notifications are blocked. Allow them in your device or browser settings.");
    } else if (nextPermission === "unsupported") {
      setMessage("This browser does not support native notifications.");
    }
    setIsEnabling(false);
  }

  async function sendTestNotification() {
    setIsTestingNotification(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/notifications/test", { method: "POST" });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      setMessage(response.ok
        ? "Test notification sent through Luna’s background delivery service."
        : result?.error ?? "Could not send the test notification.");
      if (response.status === 410) {
        setIsCurrentDeviceSubscribed(false);
        forgetNotificationSubscriptionSync(userId);
      }
    } catch {
      setMessage("Could not reach Luna’s notification service.");
    } finally {
      setIsTestingNotification(false);
    }
    window.setTimeout(() => setMessage(""), 3200);
  }

  if (!settings) return null;

  return (
    <section aria-labelledby="notifications-heading" className={`mt-3 overflow-hidden rounded-[14px] border bg-card transition-colors ${isOpen ? "border-primary/30" : "border-border"}`}>
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)} className={`flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${isOpen ? "bg-primary-soft/70" : "hover:bg-surface-subtle"}`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Bell aria-hidden="true" className="size-[18px]" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Alerts & reports</span><span id="notifications-heading" className="mt-0.5 block text-[15px] font-semibold">Notifications</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Choose what Luna tells you about.</span></span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-180 text-primary" : ""}`} />
      </button>
      {isOpen ? <>
        <div className="divide-y divide-border border-t-2 border-primary/15 bg-surface-subtle/55">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Mail aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Monthly report by email</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Receive the previous month&apos;s PDF on the first day of each month.</p>{monthlyReportEnabled ? <button type="button" onClick={() => void scheduleReportTest()} disabled={isSchedulingReportTest} className="mt-2 min-h-8 rounded-md border border-primary/25 bg-card px-2.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary-soft disabled:cursor-wait disabled:opacity-60">{isSchedulingReportTest ? "Scheduling…" : "Send test email"}</button> : null}</div>
          <button type="button" role="switch" aria-checked={monthlyReportEnabled} aria-label="Monthly report by email" disabled={isSavingMonthlyReport} onClick={() => void updateMonthlyReport(!monthlyReportEnabled)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 ${monthlyReportEnabled ? "bg-primary" : "bg-border-strong"}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${monthlyReportEnabled ? "left-6" : "left-1"}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Goal milestones</p><p className="mt-0.5 text-xs text-muted-foreground">Celebrate progress toward your goals.</p></div>
          <Toggle label="Goal milestone notifications" checked={settings.goalMilestonesEnabled} onChange={(value) => void update({ goalMilestonesEnabled: value })} />
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Recurring payment due alerts</p><p className="mt-0.5 text-xs text-muted-foreground">Know when a recurring payment is due.</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Delivery time for due-payment alerts, separate from the add-recurring reminder below.</p></div>
          <Toggle label="Recurring payment notifications" checked={settings.recurringDueEnabled} onChange={(value) => void update({ recurringDueEnabled: value })} />
        </div>
        {settings.recurringDueEnabled ? (
          <div className="px-4 pb-4 pt-0">
            <label className="block text-xs font-medium text-muted-foreground">Due-payment delivery time
              <input type="time" value={settings.recurringDueTime} onChange={(event) => setSettings({ ...settings, recurringDueTime: event.target.value })} onBlur={() => void update({ recurringDueTime: settings.recurringDueTime })} className="mt-1 min-h-10 w-full max-w-[180px] rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
            </label>
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Loan payment reminders</p><p className="mt-0.5 text-xs text-muted-foreground">Know when a loan payment is due.</p></div>
          <Toggle label="Loan payment reminders" checked={settings.loanPaymentDueEnabled} onChange={(value) => void update({ loanPaymentDueEnabled: value })} />
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">Add recurring transaction</p><p className="mt-0.5 text-xs text-muted-foreground">Remind me to record a recurring transaction at its own time and frequency.</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">This is separate from recurring payment due alerts.</p></div>
            <Toggle label="Add recurring transaction reminders" checked={settings.recurringTransactionEnabled} onChange={(value) => void update({ recurringTransactionEnabled: value })} />
          </div>
          {settings.recurringTransactionEnabled ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium text-muted-foreground">Time
                <input type="time" value={settings.recurringTransactionTime} onChange={(event) => setSettings({ ...settings, recurringTransactionTime: event.target.value })} onBlur={() => void update({ recurringTransactionTime: settings.recurringTransactionTime })} className="mt-1 min-h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">Frequency
                <span className="relative mt-1 block">
                  <button type="button" aria-haspopup="listbox" aria-expanded={isFrequencyOpen} onClick={() => setIsFrequencyOpen(!isFrequencyOpen)} className="flex min-h-10 w-full items-center justify-between rounded-[10px] border border-border bg-background px-3 text-left text-sm font-medium text-foreground outline-none transition-colors hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/10">
                    <span>{frequencyOptions.find((option) => option.value === settings.recurringTransactionFrequency)?.label}</span>
                    <ChevronDown aria-hidden="true" className={`size-4 text-muted-foreground transition-transform ${isFrequencyOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isFrequencyOpen ? (
                    <div role="listbox" aria-label="Reminder frequency" className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[10px] border border-border bg-card p-1 shadow-lg">
                      {frequencyOptions.map((option) => (
                        <button key={option.value} type="button" role="option" aria-selected={settings.recurringTransactionFrequency === option.value} onClick={() => { setIsFrequencyOpen(false); void update({ recurringTransactionFrequency: option.value }); }} className="flex min-h-10 w-full items-center justify-between rounded-[7px] px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none">
                          {option.label}
                          {settings.recurringTransactionFrequency === option.value ? <Check aria-hidden="true" className="size-4 text-primary" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </span>
              </label>
            </div>
          ) : null}
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">Low balance alerts</p><p className="mt-0.5 text-xs text-muted-foreground">Get warned when an account falls below a limit.</p></div>
            <Toggle label="Low balance notifications" checked={settings.lowBalanceEnabled} onChange={(value) => void update({ lowBalanceEnabled: value })} />
          </div>
          {settings.lowBalanceEnabled ? (
            <label className="mt-3 block text-xs font-medium text-muted-foreground">Alert below
              <div className="mt-1 flex items-center gap-2">
                <input type="number" min="0" step="1" value={settings.lowBalanceThreshold ?? ""} onChange={(event) => { const value = event.target.value === "" ? null : Math.max(0, Number(event.target.value)); setSettings({ ...settings, lowBalanceThreshold: value }); scheduleThresholdSave(value); }} onBlur={() => void confirmThreshold(settings.lowBalanceThreshold)} className="min-h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="e.g. 500" />
                <button type="button" aria-label="Confirm low balance threshold" onClick={() => void confirmThreshold(settings.lowBalanceThreshold)} disabled={isSavingThreshold} className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-wait disabled:opacity-60">
                  {isSavingThreshold ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
                </button>
              </div>
            </label>
          ) : null}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-subtle/50 px-4 py-3">
      {permission === "granted" && isCurrentDeviceSubscribed ? <><Smartphone aria-hidden="true" className="size-4 text-primary" /><span className="text-xs text-muted-foreground">Background alerts enabled on this device</span></> : <><CloudOff aria-hidden="true" className="size-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">{permission === "denied" ? "Notifications are blocked in this browser." : permission === "unsupported" ? "This browser does not support notifications." : permission === "granted" ? "Connect this device for scheduled alerts." : "Enable alerts for reminders and low balances."}</span><button type="button" onClick={() => void enableNotifications()} disabled={isEnabling || permission === "unsupported"} className="ml-auto min-h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">{isEnabling ? "Enabling…" : permission === "denied" ? "How to allow" : permission === "granted" ? "Connect device" : "Enable alerts"}</button></>}
        {permission === "granted" && isCurrentDeviceSubscribed ? <button type="button" onClick={() => void sendTestNotification()} disabled={isTestingNotification} className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:cursor-wait disabled:opacity-45">{isTestingNotification ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Check aria-hidden="true" className="size-3.5" />} Test alert</button> : null}
        </div>
        {message ? <p className="px-4 pb-3 text-[11px] text-muted-foreground">{message}</p> : null}
      </> : null}
    </section>
  );
}
