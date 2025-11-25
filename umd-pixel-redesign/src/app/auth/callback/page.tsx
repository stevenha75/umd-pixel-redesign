"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/lib/firebase";

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h1 className="text-2xl font-bold mb-4">Completing sign-in…</h1>
            <p className="text-gray-600">Loading…</p>
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
      } catch (err: any) {
        console.error("Slack auth callback failed", err);

        let errorMessage = "Authentication failed. Please try again.";
        if (err?.message) {
          if (err.message.includes("redirect_uri_mismatch") || err.code === "invalid-argument") {
            errorMessage = "Redirect URI mismatch. Please contact support.";
          } else if (err.message.includes("failed-precondition")) {
            errorMessage = "Server configuration error. Please contact support.";
          } else if (err.message.includes("permission-denied")) {
            errorMessage = "You are not authorized to access this application.";
          }
        }

        setStatus(errorMessage);
      }
    };

    authenticate();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Completing sign-in…</h1>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}
