"use client";

import { useEffect, useState } from "react";
import { Bell, Check, ChevronDown, CloudOff, Smartphone } from "lucide-react";
import {
  loadNotificationSettings,
  notificationPermission,
  requestNotificationPermission,
  saveNotificationSettings,
  showBudgetNotification,
  subscribeToPush,
  type NotificationSettings,
} from "@/lib/notifications";

type Props = { userId: string };

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

export function NotificationSettingsCard({ userId }: Props) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => notificationPermission());
  const [isEnabling, setIsEnabling] = useState(false);
  const [isFrequencyOpen, setIsFrequencyOpen] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadNotificationSettings(userId).then(setSettings);
  }, [userId]);

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
    function syncWhenOnline() {
      if (!settings) return;
      void saveNotificationSettings(userId, {
        goalMilestonesEnabled: settings.goalMilestonesEnabled,
        recurringDueEnabled: settings.recurringDueEnabled,
        recurringTransactionEnabled: settings.recurringTransactionEnabled,
        recurringTransactionTime: settings.recurringTransactionTime,
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
      const pushSubscription = await subscribeToPush();
      if (pushSubscription) await update({ pushSubscription });
      else setMessage("Notifications are ready on this device. Push sync will be added when the app is connected.");
    } else if (nextPermission === "denied") {
      setMessage("Notifications are blocked. Allow them in your device or browser settings.");
    } else if (nextPermission === "unsupported") {
      setMessage("This browser does not support native notifications.");
    }
    setIsEnabling(false);
  }

  async function sendTestNotification() {
    const shown = await showBudgetNotification("Luna is ready", "Notifications are working on this device.");
    setMessage(shown ? "Test notification sent" : "Allow notifications first");
    window.setTimeout(() => setMessage(""), 3200);
  }

  if (!settings) return null;

  return (
    <section aria-labelledby="notifications-heading" className="mt-6 overflow-hidden rounded-[14px] border border-border bg-card">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)} className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary"><Bell aria-hidden="true" className="size-[18px]" /></span>
          <span className="min-w-0 flex-1"><span id="notifications-heading" className="block text-[15px] font-semibold">Notifications</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Works offline and on installed mobile apps.</span></span>
          <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-foreground-subtle transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? <>
        <div className="divide-y divide-border border-t border-border">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Goal milestones</p><p className="mt-0.5 text-xs text-muted-foreground">Celebrate progress toward your goals.</p></div>
          <Toggle label="Goal milestone notifications" checked={settings.goalMilestonesEnabled} onChange={(value) => void update({ goalMilestonesEnabled: value })} />
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1"><p className="text-sm font-medium">Recurring reminders</p><p className="mt-0.5 text-xs text-muted-foreground">Know when a recurring payment is due.</p></div>
          <Toggle label="Recurring payment notifications" checked={settings.recurringDueEnabled} onChange={(value) => void update({ recurringDueEnabled: value })} />
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">Add recurring transaction</p><p className="mt-0.5 text-xs text-muted-foreground">Remind me to record a recurring transaction.</p></div>
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
                <input type="number" min="0" step="1" value={settings.lowBalanceThreshold ?? ""} onChange={(event) => setSettings({ ...settings, lowBalanceThreshold: event.target.value === "" ? null : Math.max(0, Number(event.target.value)) })} onBlur={() => void update({ lowBalanceThreshold: settings.lowBalanceThreshold })} className="min-h-10 w-full rounded-[10px] border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="e.g. 500" />
              </div>
            </label>
          ) : null}
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-subtle/50 px-4 py-3">
      {permission === "granted" ? <><Smartphone aria-hidden="true" className="size-4 text-primary" /><span className="text-xs text-muted-foreground">Native notifications enabled</span></> : <><CloudOff aria-hidden="true" className="size-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Settings are available offline.</span><button type="button" onClick={() => void enableNotifications()} disabled={isEnabling || permission === "unsupported"} className="ml-auto min-h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60">{isEnabling ? "Enabling…" : permission === "denied" ? "How to allow" : "Enable alerts"}</button></>}
        <button type="button" onClick={() => void sendTestNotification()} disabled={permission !== "granted"} className="ml-auto inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-45"> <Check aria-hidden="true" className="size-3.5" /> Test notification</button>
        </div>
        {message ? <p className="px-4 pb-3 text-[11px] text-muted-foreground">{message}</p> : null}
      </> : null}
    </section>
  );
}
