import Link from "next/link";
import { logOut } from "@/app/(auth)/actions";
import { getUser, homeFor, isAdmin } from "@/lib/auth";
import { btn } from "./ui";

const MEMBER_NAV = [
  { href: "/member", label: "My gear" },
  { href: "/member/offers", label: "Offers" },
  { href: "/member/settings", label: "Profile and privacy" },
];

const BRAND_NAV = [
  { href: "/brand", label: "Campaigns" },
  { href: "/brand/products", label: "Products" },
  { href: "/brand/audience", label: "Audience" },
];

export async function SiteHeader() {
  const user = await getUser();
  const nav = !user ? [] : user.role === "brand" ? BRAND_NAV : MEMBER_NAV;

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href={user ? homeFor(user.role) : "/"} className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-300 text-sm text-zinc-950">EA</span>
          Everyday Athlete
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-zinc-600">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-zinc-950">
              {item.label}
            </Link>
          ))}
          {user && isAdmin(user) && (
            <Link href="/admin/reviews" className="hover:text-zinc-950">Reviews</Link>
          )}
        </nav>
        {user ? (
          <form action={logOut} className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-500 sm:inline">{user.email}</span>
            <button className={btn("secondary")}>Log out</button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className={btn("secondary")}>Log in</Link>
            <Link href="/signup" className={btn("primary")}>Join</Link>
          </div>
        )}
      </div>
    </header>
  );
}
