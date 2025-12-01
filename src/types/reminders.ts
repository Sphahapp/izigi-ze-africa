export type ReminderType = "medication" | "appointment";
export type FrequencyType = "once" | "daily" | "weekly" | "every_x_hours";

export interface Reminder {
  id: string;
  type: ReminderType;
  title: string;
  notificationMessage?: string;
  dateTime: string; // ISO string (local time basis)
  frequency: {
    type: FrequencyType;
    days?: number[]; // 0-6 (Sun-Sat) for weekly
    everyXHours?: number; // for every_x_hours
  };
  details?: {
    dosage?: string;
    instructions?: string;
    doctor?: string;
    location?: string;
    preReminderMinutes?: number; // for appointments (e.g., 60, 1440)
  };
  isActive: boolean;
}

export const createEmptyReminder = (type: ReminderType = "medication"): Reminder => ({
  id: crypto.randomUUID(),
  type,
  title: "",
  notificationMessage: "",
  dateTime: new Date().toISOString(),
  frequency: { type: "once" },
  details: {},
  isActive: true,
});
