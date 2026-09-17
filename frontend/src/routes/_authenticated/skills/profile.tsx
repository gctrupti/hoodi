import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/hoodi/ProfileView";

export const Route = createFileRoute("/_authenticated/skills/profile")({
  component: ProfileView,
});