import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ADMIN_EMAIL = "pranavgawai1518@gmail.com";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  if (!user) redirect("/sign-in");

  const email = user.emailAddresses?.[0]?.emailAddress ?? "";
  if (email !== ADMIN_EMAIL) redirect("/dashboard");

  return <>{children}</>;
}
