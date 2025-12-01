import { useEffect, useRef, useState } from "react";
import { Reminder } from "@/types/reminders";
import { toast } from "sonner";

function nextOccurrence(reminder: Reminder, from = new Date()): Date | null {
  const base = new Date(reminder.dateTime);
  const now = from;

  const setTime = (d: Date) => {
    d.setSeconds(0, 0);
    return d;
  };

  switch (reminder.frequency.type) {
    case "once": {
      return base > now ? base : null;
    }
    case "daily": {
      const candidate = new Date(now);
      candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
      if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
      return setTime(candidate);
    }
    case "weekly": {
      const days = reminder.frequency.days && reminder.frequency.days.length ? reminder.frequency.days : [base.getDay()];
      const candidate = new Date(now);
      candidate.setHours(base.getHours(), base.getMinutes(), 0, 0);
      for (let i = 0; i < 14; i++) {
        const day = candidate.getDay();
        if (days.includes(day) && candidate > now) return setTime(new Date(candidate));
        candidate.setDate(candidate.getDate() + 1);
      }
      return null;
    }
    case "every_x_hours": {
      const interval = reminder.frequency.everyXHours ?? 4;
      // Start from base and add intervals until in the future
      const candidate = new Date(base);
      while (candidate <= now) {
        candidate.setHours(candidate.getHours() + interval);
      }
      return setTime(candidate);
    }
    default:
      return null;
  }
}

export function useReminderScheduler(reminders: Reminder[], opts?: { tts?: boolean }) {
  const timeoutsRef = useRef<Record<string, number>>({});
  const [permission, setPermission] = useState<NotificationPermission>(Notification.permission);
  const enableTTS = opts?.tts ?? true;

  const clearAll = () => {
    Object.values(timeoutsRef.current).forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = {};
  };

  const speak = (text: string) => {
    try {
      if (!enableTTS || !("speechSynthesis" in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {}
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alertActiveRef = useRef(false);

  const startAlert = (text: string) => {
    alertActiveRef.current = true;
    // Looping alarm sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/reminder.ogg');
        audioRef.current.loop = true;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {}

    // Looping TTS
    try {
      if (enableTTS && 'speechSynthesis' in window) {
        const synth = window.speechSynthesis;
        if (synth.speaking) synth.cancel();
        const speakLoop = () => {
          if (!alertActiveRef.current) return;
          const utter = new SpeechSynthesisUtterance(text);
          utter.rate = 1.0;
          utter.pitch = 1.0;
          utter.onend = () => {
            if (alertActiveRef.current) setTimeout(speakLoop, 1000);
          };
          try {
            synth.speak(utter);
          } catch {}
        };
        speakLoop();
      }
    } catch {}
  };

  const stopAlert = () => {
    alertActiveRef.current = false;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    try {
      toast.dismiss();
    } catch {}
  };

  const notify = (title: string, body: string) => {
    if (permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {}
    }
    startAlert(body);
    toast(`${title}`, {
      description: body,
      duration: Infinity,
      action: {
        label: 'Stop',
        onClick: () => stopAlert(),
      },
    });
  };

  const schedule = (reminder: Reminder) => {
    if (!reminder.isActive) return;
    const next = nextOccurrence(reminder);
    if (!next) return;
    const delay = Math.max(0, next.getTime() - Date.now());
    const timerId = window.setTimeout(() => {
      const message = reminder.notificationMessage || `Reminder: ${reminder.title}`;
      notify(reminder.type === "medication" ? "Medication Reminder" : "Appointment Reminder", message);

      // Reschedule if recurring
      if (reminder.frequency.type !== "once") schedule(reminder);
    }, Math.min(delay, 2147483647)); // setTimeout max ~24.8 days
    timeoutsRef.current[reminder.id] = timerId;
  };

  useEffect(() => {
    clearAll();
    reminders.forEach(schedule);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(reminders)]);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications are not supported in this browser");
      return Notification.permission;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === "granted") toast.success("Notifications enabled");
    return perm;
  };

  return { requestPermission, permission, stopAlert };
}
