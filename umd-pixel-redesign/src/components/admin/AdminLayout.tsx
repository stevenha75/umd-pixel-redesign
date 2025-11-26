"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
};

const links = [
  { href: "/admin", label: "Events" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/activities", label: "Activities" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminLayout({ children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/20">
      <Navbar />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-60 flex-shrink-0 rounded-2xl border border-primary/10 bg-white/90 p-4 shadow-sm backdrop-blur md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 8h14M5 16h10" />
              </svg>
            </div>
            <div className="text-sm font-semibold text-foreground">Admin</div>
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
