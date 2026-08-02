"use client";

import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";

import {
  getActiveOfflineUserId,
  getOfflineDatabase,
  OFFLINE_DATA_CHANGED_EVENT,
} from "@/lib/offline/database";
import type { OfflineSnapshot } from "@/lib/offline/types";

const EMPTY_SNAPSHOT: OfflineSnapshot = {
  profile: null,
  accounts: [],
  categories: [],
  savingsInstruments: [],
  transactions: [],
};

function currentMonthBounds() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function useOfflineSnapshot() {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    const subscribe = async () => {
      const userId = getActiveOfflineUserId();
      if (!userId) {
        if (active) {
          setSnapshot(EMPTY_SNAPSHOT);
          setIsLoading(false);
        }
        return;
      }
      try {
        const db = await getOfflineDatabase();
        const { from, to } = currentMonthBounds();
        const stream = combineLatest([
          db.profiles.findOne(userId).$,
          db.accounts.find({ selector: { userId }, sort: [{ displayOrder: "asc" }] }).$,
          db.categories.find({ selector: { userId }, sort: [{ name: "asc" }] }).$,
          db.savingsInstruments.find({ selector: { userId }, sort: [{ name: "asc" }] }).$,
          db.transactions.find({
            selector: { userId, date: { $gte: from, $lte: to } },
            sort: [{ transactionAt: "desc" }],
          }).$,
        ]).subscribe(([profile, accounts, categories, savingsInstruments, transactions]) => {
          if (!active) return;
          setSnapshot({
            profile: profile?.toJSON() ?? null,
            accounts: accounts.map((document) => document.toJSON()),
            categories: categories.map((document) => document.toJSON()),
            savingsInstruments: savingsInstruments.map((document) => document.toJSON()),
            transactions: transactions.map((document) => {
              const transaction = document.toJSON();
              return { ...transaction, tags: [...transaction.tags] };
            }),
          });
          setIsLoading(false);
          setError("");
        });
        unsubscribe = () => stream.unsubscribe();
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Offline data is unavailable.");
        setIsLoading(false);
      }
    };

    void subscribe();
    const resubscribe = () => {
      unsubscribe();
      void subscribe();
    };
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, resubscribe);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, resubscribe);
    };
  }, []);

  return { snapshot, isLoading, error };
}
