"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

type AccountProfileProps = {
  email: string;
  fullName: string | null;
};

export function AccountProfile({ email, fullName }: AccountProfileProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-modal)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
          Your Account
        </p>
        <h1 className="mt-2 font-heading text-4xl text-[var(--foreground)]">
          {fullName ? fullName.split(/\s+/)[0] : "Account"}
        </h1>

        <div className="mt-6 space-y-3">
          {fullName ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Name
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{fullName}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Email
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{email}</p>
          </div>
        </div>

        <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Guest orders
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--foreground)]">
            Orders placed on this device appear under <strong>Current Order</strong> and stay available for 24 hours after pickup.
          </p>
        </div>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={() => {
            void handleSignOut();
          }}
          className="mt-6 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--surface-raised)] disabled:opacity-60"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
