"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-700">Loading...</p>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-700">Admins only.</p>
      </div>
    );
  }

  return <>{children}</>;
}
