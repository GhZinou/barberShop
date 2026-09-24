import { create } from 'zustand'

export interface SelectedService {
  id: string
  name: string
  duration: number
}

interface BookingState {
  selectedService: SelectedService | null
  selectedDate: Date | null
  selectedTime: string | null
  setSelectedService: (service: SelectedService | null) => void
  setSelectedDate: (date: Date | null) => void
  setSelectedTime: (time: string | null) => void
  reset: () => void
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedService: null,
  selectedDate: null,
  selectedTime: null,
  setSelectedService: (service) => set({ selectedService: service }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setSelectedTime: (time) => set({ selectedTime: time }),
  reset: () =>
    set({
      selectedService: null,
      selectedDate: null,
      selectedTime: null,
    }),
}))