"use client";

import { createContext, useContext, useMemo } from "react";

const PermissionsContext = createContext({ permissions: [], has: () => false });

export function PermissionsProvider({ permissions = [], children }) {
  const value = useMemo(() => {
    const set = new Set(permissions);
    return {
      permissions,
      has: (code) => set.has(code),
      hasAny: (codes = []) => codes.some((c) => set.has(c)),
      hasAll: (codes = []) => codes.every((c) => set.has(c)),
    };
  }, [permissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

export default PermissionsProvider;
