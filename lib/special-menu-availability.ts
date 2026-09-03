export interface MenuAvailabilitySchedule {
  days?: number[] | null;
  startDate?: string | null;
  endDate?: string | null;
}

export function isPubliclyAvailableOnServiceDate(schedule: MenuAvailabilitySchedule | undefined, serviceDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!match) return false;

  const [, year, month, day] = match;
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  if (schedule?.days && schedule.days.length > 0 && !schedule.days.includes(weekday)) return false;
  if (schedule?.startDate && serviceDate < schedule.startDate) return false;
  if (schedule?.endDate && serviceDate > schedule.endDate) return false;
  return true;
}
