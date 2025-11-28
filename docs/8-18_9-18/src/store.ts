import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { workzones } from '@/utils';

interface AppState {
  workzoneId: string;
}

interface Actions {
  setWorkzoneId: (id: string) => void;
}

type StoreState = AppState & Actions;

const firstWorkzoneId = workzones[0].workzone_id;

const urlStorage: StateStorage = {
  getItem: (key): string | null => {
    const searchParams = new URLSearchParams(location.search);
    const storedValue = searchParams.get(key) || '';
    return JSON.parse(storedValue);
  },
  setItem: (key, newValue): void => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set(key, JSON.stringify(newValue));
    const newUrl = `${location.pathname}?${searchParams.toString()}`;
    history.replaceState({}, '', newUrl);
  },
  removeItem: (key): void => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete(key);
    const newUrl = `${location.pathname}?${searchParams.toString()}`;
    history.replaceState({}, '', newUrl);
  },
};

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      workzoneId: firstWorkzoneId,
      setWorkzoneId: (id) => set({ workzoneId: id }),
    }),
    {
      name: 'state',
      storage: createJSONStorage(() => urlStorage),
    },
  ),
);
