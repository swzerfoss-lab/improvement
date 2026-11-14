import { requireRole } from "@/lib/auth";

export default async function BrandLayout({ children }: LayoutProps<"/brand">) {
  await requireRole("brand");
  return <main className="mx-auto w-full max-w-5xl px-6 py-10">{children}</main>;
}
