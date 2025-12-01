import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Bell, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Reminder } from "@/types/reminders";
import { ReminderForm } from "./ReminderForm";
import { ReminderList } from "./ReminderList";
import { useReminderScheduler } from "@/hooks/useReminderScheduler";
import { toast } from "sonner";
import { getSambaNovaApiKey } from "@/utils/apiKeys";

const STORAGE_KEY = "medical_reminders_v1";

function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

function saveReminders(list: Reminder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

async function parseWithAI(natural: string): Promise<Partial<Reminder> | null> {
  const apiKey = getSambaNovaApiKey();
  if (!apiKey) {
    toast.error("Please set your SambaNova API key in the Status Panel");
    return null;
  }
  const system = "You are an assistant that converts natural language medical reminder requests into JSON. Respond with ONLY JSON and no extra text.";
  const user = `Parse this reminder and return JSON with fields: {title, type (medication|appointment), date (yyyy-mm-dd), time (HH:MM 24h), frequency: {type(one of once|daily|weekly|every_x_hours), days(optional array 0-6), everyXHours(optional number)}, details: {dosage, instructions, doctor, location, preReminderMinutes}}. If missing info, infer sensible defaults.\n\nRequest: ${natural}`;

  const resp = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "Llama-4-Maverick-17B-128E-Instruct",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content || "";
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) throw new Error("AI returned invalid JSON");
  const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));

  // Map to Reminder shape (partial)
  const dt = new Date(`${parsed.date}T${parsed.time}:00`);
  return {
    title: parsed.title,
    type: parsed.type,
    dateTime: dt.toISOString(),
    frequency: parsed.frequency,
    details: parsed.details,
  } as Partial<Reminder>;
}

export const Reminders: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>(loadReminders());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [nlText, setNlText] = useState("");

  const { requestPermission, permission } = useReminderScheduler(reminders, { tts: true });

  useEffect(() => {
    saveReminders(reminders);
  }, [reminders]);

  const onSave = (r: Reminder) => {
    setReminders((prev) => {
      const exists = prev.some((x) => x.id === r.id);
      const updated = exists ? prev.map((x) => (x.id === r.id ? r : x)) : [...prev, r];
      toast.success(exists ? "Reminder updated" : "Reminder added");
      return updated;
    });
    setDialogOpen(false);
    setEditing(null);
  };

  const onEdit = (r: Reminder) => {
    setEditing(r);
    setDialogOpen(true);
  };

  const onToggleActive = (r: Reminder) => {
    setReminders((prev) => prev.map((x) => (x.id === r.id ? { ...x, isActive: !x.isActive } : x)));
  };

  const onDelete = (r: Reminder) => {
    setReminders((prev) => prev.filter((x) => x.id !== r.id));
    toast.success("Reminder deleted");
  };

  const handleParse = async () => {
    if (!nlText.trim()) {
      toast.error("Please enter a natural language request");
      return;
    }
    try {
      const partial = await parseWithAI(nlText.trim());
      if (!partial) return;
      setEditing({
        id: crypto.randomUUID(),
        title: partial.title || "",
        type: (partial as any).type || "medication",
        dateTime: partial.dateTime || new Date().toISOString(),
        frequency: partial.frequency || { type: "once" },
        details: partial.details || {},
        isActive: true,
        notificationMessage: undefined,
      });
      setDialogOpen(true);
      toast.success("Parsed with Llama-4-Maverick");
    } catch (e: any) {
      toast.error(`Failed to parse with AI: ${e.message || e}`);
    }
  };

  const header = useMemo(() => (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Medical Reminders</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={requestPermission}>
          Enable Notifications ({permission})
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> Add Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Reminder" : "Add Reminder"}</DialogTitle>
            </DialogHeader>
            <ReminderForm
              initial={editing ?? undefined}
              onSubmit={onSave}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </header>
  ), [dialogOpen, editing, permission, requestPermission]);

  return (
    <main role="main" className="space-y-6">
      {header}
      <section className="space-y-3">
        <label className="text-sm font-medium" htmlFor="nlinput">Natural language (optional)</label>
        <div className="flex flex-col md:flex-row gap-2">
          <Textarea id="nlinput" placeholder="e.g., Remind me to take 2 pills of Metformin every day at 8am" value={nlText} onChange={(e) => setNlText(e.target.value)} />
          <Button className="md:self-start" variant="secondary" onClick={handleParse}>
            <WandSparkles className="h-4 w-4 mr-2" /> Parse with AI
          </Button>
        </div>
        <Separator />
      </section>

      <section>
        <ReminderList reminders={reminders} onEdit={onEdit} onToggleActive={onToggleActive} onDelete={onDelete} />
      </section>
    </main>
  );
};
