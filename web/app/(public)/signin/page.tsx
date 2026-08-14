import { PublicMain } from "@/components/shell/public-shell";
import { SignInForm } from "./signin-form";

export const metadata = { title: "Sign in" };

/**
 * Bare, per architecture 7: the 72px header is landing and apply only. Someone
 * here is one link from being signed in and does not need a door out of it.
 */
export default function SignInPage() {
  return (
    <PublicMain className="flex flex-col gap-24">
      <h1 className="type-heading-l text-primary">Sign in</h1>
      <p className="type-body-l text-secondary">
        No password. We email you a link that signs you in.
      </p>
      <SignInForm />
    </PublicMain>
  );
}
