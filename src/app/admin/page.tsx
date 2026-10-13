import { requireRole } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const user = await requireRole("SUPER_ADMIN");
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold">admin dashboard</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {user.email}</p>
      <form action={logout} className="mt-6"><Button variant="outline">Sign out</Button></form>
    </main>
  );
}
