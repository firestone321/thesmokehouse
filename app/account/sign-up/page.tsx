import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { readSearchParamValue, resolveAuthRedirectPath } from "@/lib/auth/redirect";
import { getAuthenticatedUser } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolveAuthRedirectPath(resolvedSearchParams.next);
  const initialError = readSearchParamValue(resolvedSearchParams.error);
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/account");
  }

  return <SignUpForm nextPath={nextPath} initialError={initialError} />;
}
