import type { User } from "@supabase/supabase-js";

export const CUSTOMER_ORIGIN_METADATA_KEY = "customer_origin";
export const STOREFRONT_CUSTOMER_ORIGIN = "storefront_pwa";

type UserMetadataRecord = Record<string, unknown>;

function toUserMetadataRecord(value: unknown): UserMetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as UserMetadataRecord;
}

export function mergeStorefrontCustomerMetadata(existingMetadata?: unknown): UserMetadataRecord {
  return {
    ...toUserMetadataRecord(existingMetadata),
    [CUSTOMER_ORIGIN_METADATA_KEY]: STOREFRONT_CUSTOMER_ORIGIN,
  };
}

export function isStorefrontCustomerUser(user: Pick<User, "user_metadata">): boolean {
  const metadata = toUserMetadataRecord(user.user_metadata);
  return metadata[CUSTOMER_ORIGIN_METADATA_KEY] === STOREFRONT_CUSTOMER_ORIGIN;
}

export function isProvisionedPrivilegedUser(user: Pick<User, "app_metadata">): boolean {
  const metadata = toUserMetadataRecord(user.app_metadata);
  const requestedRole =
    typeof metadata.role === "string" ? metadata.role.trim().toLowerCase() : "";
  const provisionedByAdmin = metadata.provisioned_by_admin === true;
  return (
    provisionedByAdmin && ["admin", "manager", "staff"].includes(requestedRole)
  );
}

export function shouldBackfillStorefrontCustomerOrigin(
  user: Pick<User, "user_metadata" | "app_metadata">,
): boolean {
  return !isStorefrontCustomerUser(user) && !isProvisionedPrivilegedUser(user);
}

export function getCustomerDisplayName(
  email: string | undefined,
  fullName: string | undefined,
): string {
  const normalizedFullName = fullName?.trim();
  if (normalizedFullName) {
    return normalizedFullName.split(/\s+/)[0] ?? normalizedFullName;
  }

  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return "Account";
  }

  return normalizedEmail.split("@")[0] ?? "Account";
}
