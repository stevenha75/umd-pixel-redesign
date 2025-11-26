"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/lib/firebase";
import Image from "next/image";

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,105,202,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(128,210,200,0.18),transparent_30%)]" />
          <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white/80 px-6 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-label="Loading" />
            <div>
              <div className="text-base font-semibold text-foreground">Completing sign-in…</div>
              <p className="text-sm text-muted-foreground">Connecting to Slack.</p>
            </div>
          </div>
        </div>
      }
    >
      <SlackCallback />
    </Suspense>
  );
}

function SlackCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const redirectUri =
      process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI ||
      `${window.location.origin}/auth/callback`;

    if (error) {
      setStatus("Slack authorization was cancelled.");
      return;
    }

    if (!code) {
      router.replace("/login");
      return;
    }

    const authenticate = async () => {
      try {
        const authWithSlack = httpsCallable<
          { code: string; redirectUri: string },
          { token: string }
        >(functions, "authWithSlack");
        const response = await authWithSlack({ code, redirectUri });
        const token = response?.data?.token;

        if (!token) {
          throw new Error("No token returned from Slack authentication.");
        }

        await signInWithCustomToken(auth, token);
        router.replace("/");
      } catch (err: unknown) {
        console.error("Slack auth callback failed", err);

        let errorMessage = "Authentication failed. Please try again.";
        const message = err instanceof Error ? err.message : "";
        const code =
          typeof err === "object" && err !== null && "code" in err
            ? (err as { code?: string }).code
            : undefined;

        if (message.includes("redirect_uri_mismatch") || code === "invalid-argument") {
          errorMessage = "Redirect URI mismatch. Please contact support.";
        } else if (message.includes("failed-precondition")) {
          errorMessage = "Server configuration error. Please contact support.";
        } else if (message.includes("permission-denied")) {
          errorMessage = "You are not authorized to access this application.";
        }

        setStatus(errorMessage);
      }
    };

    authenticate();
  }, [router, searchParams]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/20 px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(0,105,202,0.14),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(128,210,200,0.2),transparent_30%)]" />
      <div className="w-full max-w-lg rounded-3xl border border-primary/10 bg-white/85 p-8 text-center shadow-lg backdrop-blur">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20">
          <Image src="/images/h4i.png" alt="Hack4Impact" width={28} height={28} className="h-7 w-7" priority />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Completing sign-in…</h1>
        <p className="mt-2 text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
