import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountProfile } from "@/components/auth/account-profile";
import { getAuthenticatedUser } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/account/sign-in?next=/account");
  }

  const userMetadata = user.user_metadata as { full_name?: string } | undefined;

  return (
    <AccountProfile
      email={user.email ?? ""}
      fullName={userMetadata?.full_name ?? null}
    />
  );
}
