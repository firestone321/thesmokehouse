"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { getCustomerDisplayName } from "@/lib/auth/customer-source";
import { resolveAuthRedirectPath } from "@/lib/auth/redirect";

export function AccountMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const nextPath = resolveAuthRedirectPath(pathname ?? undefined);

  if (isLoading) {
    return (
      <span className="hidden text-xs font-bold text-[var(--muted)] md:block">
        …
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href={`/account/sign-in?next=${encodeURIComponent(nextPath)}`}
        className="hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] transition hover:bg-[var(--surface-alt)] md:block"
      >
        Sign In
      </Link>
    );
  }

  const userMetadata = user.user_metadata as { full_name?: string } | undefined;
  const displayName = getCustomerDisplayName(user.email, userMetadata?.full_name);

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Link
        href="/account"
        className="max-w-28 truncate rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      >
        {displayName}
      </Link>
      <button
        type="button"
        disabled={isSigningOut}
        onClick={() => {
          setIsSigningOut(true);
          void signOut()
            .then(() => {
              router.replace("/");
              router.refresh();
            })
            .finally(() => {
              setIsSigningOut(false);
            });
        }}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--foreground)] transition hover:bg-[var(--surface-alt)] disabled:opacity-60"
      >
        {isSigningOut ? "…" : "Sign out"}
      </button>
    </div>
  );
}
