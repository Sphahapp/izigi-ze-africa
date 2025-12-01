import * as React from "react";
import { Reminder } from "@/types/reminders";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pill, CalendarClock, Pencil, Trash2, PauseCircle, PlayCircle } from "lucide-react";
import { isToday, isTomorrow, isThisWeek } from "date-fns";

function TypeIcon({ type }: { type: Reminder["type"] }) {
  return type === "medication" ? <Pill className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />;
}

function sectionLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "This Week";
  return "Later";
}

export interface ReminderListProps {
  reminders: Reminder[];
  onEdit: (r: Reminder) => void;
  onToggleActive: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ reminders, onEdit, onToggleActive, onDelete }) => {
  const groups = new Map<string, Reminder[]>();
  reminders
    .slice()
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .forEach((r) => {
      const label = sectionLabel(new Date(r.dateTime));
      groups.set(label, [...(groups.get(label) || []), r]);
    });

  if (reminders.length === 0) {
    return <div className="text-muted-foreground">No reminders yet. Click "Add Reminder" to create one.</div>;
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([label, items]) => (
        <section key={label}>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{label}</h2>
            <Separator className="flex-1 ml-4" />
          </header>
          <div className="grid gap-3">
            {items.map((r) => (
              <Card key={r.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TypeIcon type={r.type} />
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(r.dateTime).toLocaleString()} • {r.type === "medication" ? (r.details?.dosage || "") : (r.details?.location || "")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.isActive ? "default" : "secondary"}>{r.isActive ? "Active" : "Paused"}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => onEdit(r)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onToggleActive(r)} aria-label={r.isActive ? "Pause" : "Resume"}>
                    {r.isActive ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onDelete(r)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
