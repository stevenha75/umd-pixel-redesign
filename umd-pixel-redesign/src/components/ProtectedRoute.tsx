"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/LoadingState";

type Props = {
  children: React.ReactNode;
  requireAdmin?: boolean;
};

export function ProtectedRoute({ children, requireAdmin = false }: Props) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requireAdmin && !isAdmin) {
      router.replace("/");
    }
  }, [loading, user, router, requireAdmin, isAdmin]);

  if (loading || !user) {
    return <LoadingState fullHeight title="Loading…" subtitle="Signing you in." />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm border-amber-200 bg-amber-50 text-amber-900 shadow-sm">
          <CardContent className="p-6 space-y-3 text-sm">
            <div className="font-semibold">Admins only</div>
            <div>You do not have access to this page.</div>
            <Button variant="outline" onClick={() => router.replace("/")}>
              Go home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
