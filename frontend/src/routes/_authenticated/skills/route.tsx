import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GraduationCap, BookOpen, CalendarCheck, User } from "lucide-react";
import { ProductShell, type ShellNavItem } from "@/components/hoodi/ProductShell";

const NAV: ShellNavItem[] = [
  { to: "/skills/learn", label: "Learn", icon: BookOpen },
  { to: "/skills/teach", label: "Teach", icon: GraduationCap, primary: true },
  { to: "/skills/bookings", label: "My Bookings", icon: CalendarCheck },
  { to: "/skills/profile", label: "Profile", icon: User },
];

const MOBILE: ShellNavItem[] = [
  { to: "/skills/learn", label: "Learn", icon: BookOpen },
  { to: "/skills/bookings", label: "Bookings", icon: CalendarCheck },
  { to: "/skills/teach", label: "Teach", icon: GraduationCap, primary: true },
  { to: "/skills/profile", label: "Me", icon: User },
];

export const Route = createFileRoute("/_authenticated/skills")({
  component: () => (
    <ProductShell brand="Hoodi Skills" brandIcon={GraduationCap} homeHref="/skills" nav={NAV} mobileNav={MOBILE}>
      <Outlet />
    </ProductShell>
  ),
});