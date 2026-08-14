const WEEKEND_SPECIAL_ITEM_NAMES = new Set(["oxtail", "oxtails", "beef oxtail", "beef oxtails", "goat ribs"]);

export function isWeekendSpecialMenuItem(name: string): boolean {
  return WEEKEND_SPECIAL_ITEM_NAMES.has(name.trim().toLowerCase());
}

export function isFridayThroughSundayServiceDate(serviceDate: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!match) return false;

  const [, year, month, day] = match;
  const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  return weekday === 0 || weekday === 5 || weekday === 6;
}

export function isPubliclyAvailableOnServiceDate(itemName: string, serviceDate: string): boolean {
  return !isWeekendSpecialMenuItem(itemName) || isFridayThroughSundayServiceDate(serviceDate);
}
