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
  loans: [],
  transactions: [],
  budgets: [],
  budgetMutations: [],
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
    let generation = 0;
    let unsubscribe: () => void = () => undefined;

    const subscribe = async () => {
      const subscriptionGeneration = ++generation;
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
          db.loans.find({ selector: { userId }, sort: [{ name: "asc" }] }).$,
          db.transactions.find({
            selector: { userId, date: { $gte: from, $lte: to } },
            sort: [{ transactionAt: "desc" }],
          }).$,
          db.budgets.find({ selector: { userId, deleted: false }, sort: [{ period: "asc" }] }).$,
          db.budgetMutations.find({ selector: { userId }, sort: [{ createdAt: "asc" }] }).$,
        ]).subscribe({
          next: ([profile, accounts, categories, savingsInstruments, loans, transactions, budgets, budgetMutations]) => {
            if (!active || subscriptionGeneration !== generation) return;
            setSnapshot({
              profile: profile?.toJSON() ?? null,
              accounts: accounts.map((document) => document.toJSON()),
              categories: categories.map((document) => document.toJSON()),
              savingsInstruments: savingsInstruments.map((document) => document.toJSON()),
              loans: loans.map((document) => document.toJSON()),
              transactions: transactions.map((document) => {
                const transaction = document.toJSON();
                return { ...transaction, tags: [...transaction.tags] };
              }),
              budgets: budgets.map((document) => document.toJSON()),
              budgetMutations: budgetMutations.map((document) => document.toJSON()),
            });
            setIsLoading(false);
            setError("");
          },
          error: (reason) => {
            if (!active || subscriptionGeneration !== generation) return;
            console.error("Offline snapshot subscription failed", reason);
            setError("Offline data could not be opened. Reconnect and try again.");
            setIsLoading(false);
          },
        });
        if (!active || subscriptionGeneration !== generation) {
          stream.unsubscribe();
          return;
        }
        unsubscribe = () => stream.unsubscribe();
      } catch (reason) {
        if (!active || subscriptionGeneration !== generation) return;
        console.error("Offline database initialization failed", reason);
        setError("Offline data could not be opened. Reconnect and try again.");
        setIsLoading(false);
      }
    };

    void subscribe();
    const resubscribe = () => {
      generation += 1;
      unsubscribe();
      void subscribe();
    };
    window.addEventListener(OFFLINE_DATA_CHANGED_EVENT, resubscribe);
    return () => {
      active = false;
      generation += 1;
      unsubscribe();
      window.removeEventListener(OFFLINE_DATA_CHANGED_EVENT, resubscribe);
    };
  }, []);

  return { snapshot, isLoading, error };
}
