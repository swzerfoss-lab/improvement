import { requireRole } from "@/lib/auth";

export default async function MemberLayout({ children }: LayoutProps<"/member">) {
  await requireRole("member");
  return <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>;
}
