"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen, searchOpen, setSearchOpen, terminalOpen, setTerminalOpen }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextType {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be used within LayoutProvider");
  return ctx;
}
