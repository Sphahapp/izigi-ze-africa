import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Pill, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Reminder, ReminderType } from "@/types/reminders";

const FormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["medication", "appointment"]).default("medication"),
  title: z.string().min(1, "Title is required"),
  date: z.date(),
  time: z.string().min(1, "Time is required"),
  frequencyType: z.enum(["once", "daily", "weekly", "every_x_hours"]).default("once"),
  weeklyDays: z.array(z.number()).optional(),
  everyXHours: z.coerce.number().optional(),
  dosage: z.string().optional(),
  instructions: z.string().optional(),
  doctor: z.string().optional(),
  location: z.string().optional(),
  preReminderMinutes: z.coerce.number().optional(),
  isActive: z.boolean().default(true),
});

export type ReminderFormValues = z.infer<typeof FormSchema>;

function combineDateTime(date: Date, time: string) {
  const [h, m] = time.split(":" ).map(Number);
  const d = new Date(date);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString();
}

function splitToDateTime(iso: string): { date: Date; time: string } {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: d, time: `${hh}:${mm}` };
}

export interface ReminderFormProps {
  initial?: Partial<Reminder>;
  onSubmit: (reminder: Reminder) => void;
  onCancel: () => void;
}

export const ReminderForm: React.FC<ReminderFormProps> = ({ initial, onSubmit, onCancel }) => {
  const defaults: Partial<ReminderFormValues> = initial
    ? {
        id: initial.id,
        type: initial.type as ReminderType,
        title: initial.title,
        ...(initial.dateTime ? splitToDateTime(initial.dateTime) : { date: new Date(), time: "09:00" }),
        frequencyType: initial.frequency?.type ?? "once",
        weeklyDays: initial.frequency?.days ?? [],
        everyXHours: initial.frequency?.everyXHours,
        dosage: initial.details?.dosage,
        instructions: initial.details?.instructions,
        doctor: initial.details?.doctor,
        location: initial.details?.location,
        preReminderMinutes: initial.details?.preReminderMinutes,
        isActive: initial.isActive ?? true,
      }
    : { type: "medication", title: "", date: new Date(), time: "09:00", frequencyType: "once", weeklyDays: [], isActive: true };

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: defaults as ReminderFormValues,
  });

  const submit = (values: ReminderFormValues) => {
    const iso = combineDateTime(values.date, values.time);
    const reminder: Reminder = {
      id: (initial?.id) || crypto.randomUUID(),
      type: values.type,
      title: values.title,
      dateTime: iso,
      frequency: {
        type: values.frequencyType,
        days: values.frequencyType === "weekly" ? values.weeklyDays : undefined,
        everyXHours: values.frequencyType === "every_x_hours" ? (values.everyXHours || 4) : undefined,
      },
      details: {
        dosage: values.dosage,
        instructions: values.instructions,
        doctor: values.doctor,
        location: values.location,
        preReminderMinutes: values.preReminderMinutes,
      },
      isActive: values.isActive,
      notificationMessage: undefined,
    };
    onSubmit(reminder);
  };

  const type = form.watch("type");
  const freq = form.watch("frequencyType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Type</FormLabel>
                <FormControl>
                  <RadioGroup className="flex gap-4" onValueChange={field.onChange} value={field.value}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medication" id="type-med" />
                      <FormLabel htmlFor="type-med" className="font-normal flex items-center gap-2"><Pill className="h-4 w-4" /> Medication</FormLabel>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="appointment" id="type-app" />
                      <FormLabel htmlFor="type-app" className="font-normal flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Appointment</FormLabel>
                    </div>
                  </RadioGroup>
                </FormControl>
                <FormDescription>Select the type of reminder.</FormDescription>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder={type === "medication" ? "Take Paracetamol" : "Appointment with Dr. Smith"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {type === "medication" && (
            <>
              <FormField
                control={form.control}
                name="dosage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dosage</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 2 tablets, 10ml" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Instructions</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Take with food" rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}

          {type === "appointment" && (
            <>
              <FormField
                control={form.control}
                name="doctor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor/Clinic</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Smith / City Clinic" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location/Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Health St." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preReminderMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pre-appointment Reminder (minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={15} placeholder="e.g., 60" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}> 
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="frequencyType"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Frequency</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Specific days of the week</SelectItem>
                    <SelectItem value="every_x_hours">Every X hours</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Choose how often to repeat.</FormDescription>
              </FormItem>
            )}
          />

          {freq === "weekly" && (
            <FormField
              control={form.control}
              name="weeklyDays"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Days of the week</FormLabel>
                  <ToggleGroup type="multiple" value={(field.value as number[] | undefined)?.map(String) ?? []} onValueChange={(v) => field.onChange(v.map(Number))}>
                    {[
                      { v: 0, l: "Sun" },
                      { v: 1, l: "Mon" },
                      { v: 2, l: "Tue" },
                      { v: 3, l: "Wed" },
                      { v: 4, l: "Thu" },
                      { v: 5, l: "Fri" },
                      { v: 6, l: "Sat" },
                    ].map((d) => (
                      <ToggleGroupItem key={d.v} value={String(d.v)} aria-label={d.l}>
                        {d.l}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </FormItem>
              )}
            />
          )}

          {freq === "every_x_hours" && (
            <FormField
              control={form.control}
              name="everyXHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Every X hours</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} step={1} placeholder="e.g., 8" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Reminder</Button>
        </div>
      </form>
    </Form>
  );
};
