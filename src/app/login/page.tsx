import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleConfigured } from "@/lib/auth";
import { mailConfigured } from "@/server/mail";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const s = await auth.api.getSession({ headers: await headers() });
  if (s) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div aria-hidden className="absolute -left-24 -top-28 size-60 rounded-full bg-peach" />
      <div aria-hidden className="absolute -right-10 -top-12 size-36 rounded-full bg-lilac" />
      <div aria-hidden className="absolute -bottom-24 -left-16 size-48 rounded-full bg-mint" />
      <div aria-hidden className="absolute -bottom-10 -right-8 size-32 rounded-full bg-sun" />
      <div aria-hidden className="absolute left-10 top-40 size-3.5 rounded-full bg-pink" />
      <div aria-hidden className="absolute right-16 top-32 size-2.5 rounded-full bg-sky" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center gap-5 px-6 pb-8 pt-10">
        <LoginForm
          urlError={error?.slice(0, 60)}
          googleReady={googleConfigured()}
          codeLogin={mailConfigured()}
          passwordLogin={process.env.ALLOW_PASSWORD_LOGIN === "true"}
        />
      </div>
    </main>
  );
}
