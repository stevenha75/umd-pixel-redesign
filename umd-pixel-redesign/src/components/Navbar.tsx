"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const initials =
    user?.displayName
      ?.split(" ")
      .map((p) => p[0])
      .join("") || "U";

  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/images/h4i.png" alt="Hack4Impact" width={32} height={32} className="h-8 w-8" />
          <div className="text-sm font-semibold leading-tight text-foreground">UMD Pixels</div>
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
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.displayName || "User"}</span>
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
          className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          ☰
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 text-sm sm:hidden">
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
