"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Image src="/images/h4i.png" alt="Hack4Impact" width={32} height={32} />
          <div className="text-sm font-semibold leading-tight text-zinc-900">
            UMD Pixels
          </div>
        </div>
        <div className="hidden items-center gap-3 text-sm sm:flex">
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
        <button
          className="inline-flex items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 text-sm sm:hidden">
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-lg border border-zinc-200 px-4 py-2 font-medium text-zinc-800 hover:bg-zinc-50"
                onClick={() => setOpen(false)}
              >
                Admin
              </Link>
            )}
            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
