import { create } from "zustand";

export const useAuth = create((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
}));
