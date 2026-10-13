import Link from "next/link";
import { requireRole } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/organizers", label: "Organizers" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("SUPER_ADMIN");
  return (
    <div>
      <nav className="border-b">
        <ul className="mx-auto flex max-w-5xl gap-6 px-6 py-3 text-sm">
          {nav.map((n) => (
            <li key={n.href}><Link href={n.href} className="hover:underline">{n.label}</Link></li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
