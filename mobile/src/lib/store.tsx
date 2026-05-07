/**
 * Local state store for user-created data (appointments, payments, messages).
 *
 * Writes are persisted to SQLite immediately and enqueued for sync.
 * The in-memory arrays serve as a fast cache so the UI updates instantly
 * without re-querying the database after every insert.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Appointment, Payment, Message } from './types';
import { insertAppointment, insertPayment, insertMessage, getDatabase } from './database';

type Store = {
  /** Locally-created appointments (not yet synced) */
  newAppointments: Appointment[];
  /** Locally-created payments (not yet synced) */
  newPayments: Payment[];
  /** Locally-created messages (not yet synced) */
  newMessages: Message[];
  /** Persist an appointment to SQLite + enqueue for sync */
  addAppointment: (apt: Appointment) => void;
  /** Persist a payment to SQLite + enqueue for sync */
  addPayment: (pay: Payment) => void;
  /** Persist a message to SQLite + enqueue for sync */
  addMessage: (msg: Message) => void;
  /** Whether the database is ready */
  dbReady: boolean;
};

const StoreContext = createContext<Store>({
  newAppointments: [],
  newPayments: [],
  newMessages: [],
  addAppointment: () => {},
  addPayment: () => {},
  addMessage: () => {},
  dbReady: false,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [newAppointments, setAppointments] = useState<Appointment[]>([]);
  const [newPayments, setPayments] = useState<Payment[]>([]);
  const [newMessages, setMessages] = useState<Message[]>([]);
  const [dbReady, setDbReady] = useState(false);

  // Initialize the database on mount
  useEffect(() => {
    getDatabase()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('[Store] DB init failed:', err);
        setDbReady(true);
      });
  }, []);

  const addAppointment = useCallback((apt: Appointment) => {
    setAppointments((prev) => [apt, ...prev]);
    insertAppointment(apt).catch((err) =>
      console.error('[Store] insertAppointment failed:', err)
    );
  }, []);

  const addPayment = useCallback((pay: Payment) => {
    setPayments((prev) => [pay, ...prev]);
    insertPayment(pay).catch((err) =>
      console.error('[Store] insertPayment failed:', err)
    );
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
    insertMessage(msg).catch((err) =>
      console.error('[Store] insertMessage failed:', err)
    );
  }, []);

  return (
    <StoreContext.Provider value={{
      newAppointments, newPayments, newMessages,
      addAppointment, addPayment, addMessage,
      dbReady,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
