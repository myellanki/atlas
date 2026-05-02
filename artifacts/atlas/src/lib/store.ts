import { create } from "zustand";

interface AppState {
  role: "admin" | "member";
  setRole: (role: "admin" | "member") => void;
  selectedCardId: number | null;
  setSelectedCardId: (id: number | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: "admin", // Default to admin for this build
  setRole: (role) => set({ role }),
  selectedCardId: null,
  setSelectedCardId: (id) => set({ selectedCardId: id }),
}));
