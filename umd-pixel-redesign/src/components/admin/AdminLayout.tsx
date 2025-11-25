"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
};

const links = [
  { href: "/admin", label: "Events" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminLayout({ children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="hidden w-56 flex-shrink-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm md:block">
          <div className="text-sm font-semibold text-zinc-900">Admin</div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-2 font-medium ${
                    active
                      ? "bg-black text-white"
                      : "text-zinc-800 hover:bg-zinc-100"
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
