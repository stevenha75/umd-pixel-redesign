"use client";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const SLACK_CLIENT_ID = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const SLACK_REDIRECT_URI = process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI;
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleLogin = () => {
    if (!SLACK_CLIENT_ID) {
      alert("Slack client ID is not configured.");
      return;
    }

    const redirectUri =
      SLACK_REDIRECT_URI || `${window.location.origin}/auth/callback`;
    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&user_scope=identity.basic,identity.email,identity.avatar&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = slackAuthUrl;
  };

  if (loading)
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,105,202,0.12),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(128,210,200,0.18),transparent_30%)]" />
        <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white/80 px-6 py-4 text-sm text-muted-foreground shadow-sm backdrop-blur">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-label="Loading" />
          <div>
            <div className="text-base font-semibold text-foreground">Loading…</div>
            <p className="text-sm text-muted-foreground">Checking your session.</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/20">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(0,105,202,0.14),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(128,210,200,0.2),transparent_30%)]" />
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
        <div className="w-full rounded-3xl border border-primary/10 bg-white/80 p-10 shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20">
              <Image src="/images/h4i.png" alt="Hack4Impact" width={32} height={32} className="h-8 w-8" priority />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                Hack4Impact UMD
              </p>
              <h1 className="text-3xl font-bold text-foreground">UMD Pixels</h1>
            </div>
          </div>
          <p className="mt-6 text-base text-muted-foreground">
            Sign in to view your pixels, track attendance, and stay in sync with Hack4Impact events.
          </p>
          <div className="mt-8 space-y-4">
            <Button
              onClick={handleLogin}
              className="w-full bg-[#4A154B] text-white hover:bg-[#36103D]"
              size="lg"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.522 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.522v-2.52h2.522zM15.165 17.688a2.527 2.527 0 0 1-2.522-2.521 2.527 2.527 0 0 1 2.522-2.522h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
              </svg>
              Sign in with Slack
            </Button>
            <p className="text-xs text-muted-foreground">
              Use your Hack4Impact UMD Slack account to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
