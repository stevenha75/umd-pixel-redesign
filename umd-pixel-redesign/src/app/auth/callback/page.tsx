"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "@/lib/firebase";
import { Suspense } from "react";

export default function SlackCallback() {
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
      } catch (err) {
        console.error("Slack auth callback failed", err);
        setStatus("Authentication failed. Please try again.");
      }
    };

    authenticate();
  }, [router, searchParams]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold mb-4">Completing sign-in…</h1>
          <p className="text-gray-600">{status}</p>
        </div>
      </div>
    </Suspense>
  );
}
