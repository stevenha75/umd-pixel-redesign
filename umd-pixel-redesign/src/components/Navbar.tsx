"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchName = async () => {
      if (!user?.uid) {
        setProfileName(null);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!cancelled) {
          const data = snap.data() || {};
          const name = `${data.firstName || ""} ${data.lastName || ""}`.trim();
          setProfileName(name || null);
        }
      } catch (err) {
        console.error("Failed to load profile name", err);
        if (!cancelled) setProfileName(null);
      }
    };
    fetchName();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const name = profileName || user?.displayName || "User";
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("") || "U";

  return (
    <nav className="sticky top-0 z-30 border-b border-primary/10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Image src="/images/h4i.png" alt="Hack4Impact" width={28} height={28} className="h-7 w-7" priority />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">Hack4Impact UMD</span>
            <span className="text-sm font-semibold text-foreground">Pixels</span>
          </div>
        </div>
        <div className="hidden items-center gap-3 text-sm sm:flex">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/admin">Admin</Link>
            </Button>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-9 w-9 ring-1 ring-primary/20">
                    <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
        <button
          className="inline-flex items-center justify-center rounded-full border border-primary/20 bg-white px-3 py-2 text-sm font-semibold text-foreground shadow-xs hover:bg-primary/10 sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-primary/10 bg-white px-4 py-3 text-sm shadow-sm sm:hidden">
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <Button
                asChild
                variant="outline"
                className="justify-start"
                onClick={() => setOpen(false)}
              >
                <Link href="/admin">Admin</Link>
              </Button>
            )}
            {user ? (
              <Button
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="justify-start"
              >
                Sign out
              </Button>
            ) : (
              <Button asChild className="justify-start" onClick={() => setOpen(false)}>
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
