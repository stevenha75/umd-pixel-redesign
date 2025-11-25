"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();

  return (
    <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/images/h4i.png" alt="Hack4Impact" width={32} height={32} />
          <div className="text-sm font-semibold leading-tight text-zinc-900">
            UMD Pixels
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full border border-zinc-200 px-4 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={signOut}
              className="rounded-full bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
