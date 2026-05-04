import { SupabaseClient } from "@supabase/supabase-js";

type LooseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type Database = {
  public: {
    Tables: Record<string, LooseTable>;
    Views: Record<string, never>;
    Functions: Record<
      string,
      {
        Args: Record<string, unknown>;
        Returns: unknown;
      }
    >;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type SupabaseAdminClient = SupabaseClient<Database>;

export interface MenuItemStockRow {
  id: number;
  portion_type_id: number | null;
}

interface DailyStockRow {
  portion_type_id: unknown;
  remaining_quantity: unknown;
}

interface FinishedStockRow {
  portion_type_id: unknown;
  current_quantity: unknown;
}

export interface StockSource {
  sourcePortionTypeId: number;
  unitsPerServing: number;
}

export interface ResolvedStock {
  availableQuantity: number;
  isInStock: boolean;
  isLowStock: boolean;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getUgandaServiceDate(reference = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(reference);
}

export function resolveStockForPortion(
  portionTypeId: number | null | undefined,
  dailyStockMap: Map<number, number>,
  finishedStockMap: Map<number, number>,
  stockSource?: StockSource
): ResolvedStock {
  const normalizedPortionTypeId = Number.isFinite(portionTypeId) ? Number(portionTypeId) : 0;

  let availableQuantity = 0;

  if (normalizedPortionTypeId > 0) {
    const lookupId = stockSource && stockSource.sourcePortionTypeId > 0
      ? stockSource.sourcePortionTypeId
      : normalizedPortionTypeId;
    const divisor = stockSource && stockSource.unitsPerServing > 1
      ? stockSource.unitsPerServing
      : 1;

    let rawQuantity = 0;
    if (dailyStockMap.has(lookupId)) {
      rawQuantity = dailyStockMap.get(lookupId) ?? 0;
    } else if (finishedStockMap.has(lookupId)) {
      rawQuantity = finishedStockMap.get(lookupId) ?? 0;
    }

    availableQuantity = Math.floor(rawQuantity / divisor);
  }

  return {
    availableQuantity,
    isInStock: availableQuantity > 0,
    isLowStock: availableQuantity >= 1 && availableQuantity <= 10
  };
}

export async function loadSellableStockMaps(
  supabase: SupabaseAdminClient,
  portionTypeIds: Array<number | null | undefined>,
  serviceDate = getUgandaServiceDate(),
  sourcePortionTypeIds: Array<number | null | undefined> = []
) {
  const normalizedPortionTypeIds = Array.from(
    new Set(
      [...portionTypeIds, ...sourcePortionTypeIds]
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

  if (normalizedPortionTypeIds.length === 0) {
    return {
      dailyStockMap: new Map<number, number>(),
      finishedStockMap: new Map<number, number>()
    };
  }

  const [dailyStockResponse, finishedStockResponse] = await Promise.all([
    supabase
      .from("daily_stock")
      .select("portion_type_id,remaining_quantity")
      .eq("stock_date", serviceDate)
      .in("portion_type_id", normalizedPortionTypeIds),
    supabase
      .from("finished_stock")
      .select("portion_type_id,current_quantity")
      .in("portion_type_id", normalizedPortionTypeIds)
  ]);

  if (dailyStockResponse.error) {
    throw new Error(`Failed to load daily stock: ${dailyStockResponse.error.message}`);
  }

  if (finishedStockResponse.error) {
    throw new Error(`Failed to load finished stock: ${finishedStockResponse.error.message}`);
  }

  const dailyStockMap = new Map<number, number>();
  const finishedStockMap = new Map<number, number>();

  for (const row of (dailyStockResponse.data ?? []) as DailyStockRow[]) {
    dailyStockMap.set(toNumber(row.portion_type_id), Math.max(0, toNumber(row.remaining_quantity)));
  }

  for (const row of (finishedStockResponse.data ?? []) as FinishedStockRow[]) {
    finishedStockMap.set(toNumber(row.portion_type_id), Math.max(0, toNumber(row.current_quantity)));
  }

  return { dailyStockMap, finishedStockMap };
}
