"use client";

import Link from "next/link";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { mergeStorefrontCustomerMetadata } from "@/lib/auth/customer-source";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignUpFormProps = {
  initialError?: string | null;
  nextPath: string;
};

export function SignUpForm({ initialError = null, nextPath }: SignUpFormProps) {
  const [error, setError] = useState<string | null>(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onAction = async (formData: FormData) => {
    setError(null);
    setIsSubmitting(true);

    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: mergeStorefrontCustomerMetadata({ full_name: fullName }),
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    // Full navigation so the new session cookie is picked up server-side.
    window.location.replace(nextPath);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-modal)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--muted)]">
          Firestone Country Smokehouse
        </p>
        <h1 className="mt-2 font-heading text-4xl text-[var(--foreground)]">Create Account</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Save your details for faster checkout and order tracking.
        </p>

        <div className="mt-6 space-y-4">
          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <GoogleAuthButton flow="sign-up" nextPath={nextPath} />

          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
            <span>Or use email</span>
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
          </div>

          <form action={onAction} className="space-y-3">
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              Full Name
              <input
                name="full_name"
                type="text"
                autoComplete="name"
                required
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              Password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground)]">
              Confirm Password
              <input
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link
            href={`/account/sign-in?next=${encodeURIComponent(nextPath)}`}
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
