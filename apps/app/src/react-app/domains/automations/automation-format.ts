import type { AutomationSchedule } from "@openwork/types/automations";

const SUNDAY_UTC = Date.UTC(2024, 0, 7);

export function formatAutomationWeekdays(daysOfWeek: number[], locales?: Intl.LocalesArgument) {
  const formatter = new Intl.DateTimeFormat(locales ?? "zh-CN", {
    weekday: "short",
    timeZone: "UTC",
  });

  return daysOfWeek
    .map((day) => formatter.format(new Date(SUNDAY_UTC + day * 24 * 60 * 60 * 1_000)))
    .join(", ");
}

export function formatAutomationTime(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${month}月${day}日 ${hours}:${minutes}`;
}

export function formatAutomationSchedule(schedule: AutomationSchedule) {
  if (schedule.kind === "once") {
    return `单次 · ${formatAutomationTime(schedule.at)}`;
  }
  if (schedule.kind === "interval") {
    const mins = schedule.intervalMinutes;
    if (mins >= 60 && mins % 60 === 0) {
      return `每 ${mins / 60} 小时`;
    }
    return `每 ${mins} 分钟`;
  }
  const time = `${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`;
  if (schedule.kind === "daily") {
    return `每天 ${time}`;
  }
  if (schedule.kind === "weekly") {
    return `每周 (${formatAutomationWeekdays(schedule.daysOfWeek, "zh-CN")}) ${time}`;
  }
  if (schedule.kind === "monthly") {
    const dayDesc = schedule.dayOfMonth === -1 ? "最后一日" : `${schedule.dayOfMonth}日`;
    return `每月${dayDesc} ${time}`;
  }
  return `定时`;
}
