"use client";

import { SignIn } from "@clerk/nextjs";
import AuthLayout from "@/components/auth-layout";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function Page() {
  return (
    <AuthLayout>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </AuthLayout>
  );
}
