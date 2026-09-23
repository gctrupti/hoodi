import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Wrench, Compass, CalendarCheck, Briefcase } from "lucide-react";
import { ProductShell, type ShellNavItem } from "@/components/hoodi/ProductShell";

const NAV: ShellNavItem[] = [
  { to: "/services", label: "Explore", icon: Compass },
  { to: "/services/bookings", label: "My Bookings", icon: CalendarCheck },
  { to: "/services/provider/dashboard", label: "Provider Portal", icon: Briefcase, primary: true },
];

const MOBILE: ShellNavItem[] = [
  { to: "/services", label: "Explore", icon: Compass },
  { to: "/services/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/services/provider/dashboard", label: "Provider", icon: Briefcase, primary: true },
];

export const Route = createFileRoute("/_authenticated/services")({
  component: () => (
    <ProductShell brand="Hoodi Services" brandIcon={Wrench} homeHref="/services" nav={NAV} mobileNav={MOBILE}>
      <Outlet />
    </ProductShell>
  ),
});
