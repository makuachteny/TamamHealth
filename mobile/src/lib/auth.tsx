/**
 * Auth context — manages patient session state.
 * Currently in bypass mode (auth skipped, demo patient loaded).
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Patient } from './types';

// Demo patient (matches seed data — JTH-000001)
const DEMO_PATIENT: Patient = {
  id: 'pat-00001',
  firstName: 'Deng',
  surname: 'Garang',
  hospitalNumber: 'JTH-000001',
  phone: '0912345678',
  dateOfBirth: '1988-03-15',
  gender: 'Male',
  registrationHospital: 'Juba Teaching Hospital',
};

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  patient: Patient | null;
  setBypass: (enabled: boolean) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState>({
  isLoading: false,
  isAuthenticated: false,
  patient: null,
  setBypass: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [patient, setPatient] = useState<Patient | null>(null);

  const setBypass = useCallback((enabled: boolean) => {
    setPatient(enabled ? DEMO_PATIENT : null);
  }, []);

  const logout = useCallback(() => {
    setPatient(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      isLoading: false,
      isAuthenticated: !!patient,
      patient,
      setBypass,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
