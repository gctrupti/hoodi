import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Home, Compass, PlusCircle, LayoutDashboard, User } from "lucide-react";
import { ProductShell, type ShellNavItem } from "@/components/hoodi/ProductShell";

const NAV: ShellNavItem[] = [
  { to: "/help/nearby", label: "Nearby", icon: Compass },
  { to: "/help/ask", label: "Ask", icon: PlusCircle, primary: true },
  { to: "/help/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/help/profile", label: "Profile", icon: User },
];

const MOBILE: ShellNavItem[] = [
  { to: "/help/nearby", label: "Nearby", icon: Compass },
  { to: "/help/dashboard", label: "Home", icon: Home },
  { to: "/help/ask", label: "Ask", icon: PlusCircle, primary: true },
  { to: "/help/profile", label: "Me", icon: User },
];

export const Route = createFileRoute("/_authenticated/help")({
  component: () => (
    <ProductShell brand="Hoodi Help" brandIcon={Home} homeHref="/help" nav={NAV} mobileNav={MOBILE}>
      <Outlet />
    </ProductShell>
  ),
});