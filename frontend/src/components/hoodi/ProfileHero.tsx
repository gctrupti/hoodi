import { useRef, useState } from "react";
import { Camera, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Avatar, RatingStars, VerifiedBadge } from "./Identity";
import { uploadProfileMedia } from "@/lib/hoodi/profile-media";

type HeroProfile = {
  name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  cover_image_url?: string | null;
  phone_verified?: boolean | null;
  is_admin?: boolean | null;
  created_at?: string | null;
};

/**
 * Instagram/LinkedIn-style header: wide cover, overlapping avatar,
 * identity line with trust badges. Both images upload in place.
 */
export function ProfileHero({
  profile,
  place,
  avgScore,
  ratingCount,
  onImage,
}: {
  profile: HeroProfile | null | undefined;
  place?: string | null;
  avgScore?: number | null;
  ratingCount?: number | null;
  onImage: (kind: "avatar" | "cover", url: string) => void;
}) {
  const [busy, setBusy] = useState<"avatar" | "cover" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function handle(kind: "avatar" | "cover", file?: File | null) {
    if (!file) return;
    setBusy(kind);
    try {
      const url = await uploadProfileMedia(file, kind);
      onImage(kind, url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null;

  return (
    <section className="hoodi-rise overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft">
      <div className="relative h-40 bg-linear-to-br from-clay-soft via-sand to-primary/20 sm:h-52">
        {profile?.cover_image_url && (
          <img
            src={profile.cover_image_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        )}
        <button
          onClick={() => coverInput.current?.click()}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card/85 px-3 py-1.5 text-xs font-semibold text-ink shadow-soft backdrop-blur transition hover:bg-card"
        >
          {busy === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          Cover
        </button>
        <input
          ref={coverInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handle("cover", e.target.files?.[0])}
        />
      </div>

      <div className="px-5 pb-5 sm:px-7 sm:pb-7">
        <div className="-mt-14 flex flex-wrap items-end gap-4">
          <div className="relative">
            <Avatar src={profile?.profile_photo_url} name={profile?.name} size="xl" className="ring-4 ring-card" />
            <button
              onClick={() => avatarInput.current?.click()}
              aria-label="Change profile photo"
              className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift transition hover:scale-105"
            >
              {busy === "avatar" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handle("avatar", e.target.files?.[0])}
            />
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {profile?.name || "Your neighborhood profile"}
              </h1>
              {profile?.phone_verified && <VerifiedBadge label="Phone verified" />}
              {profile?.is_admin && <VerifiedBadge label="Hoodi team" tone="neutral" />}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
              <RatingStars score={avgScore} count={ratingCount} />
              {place && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-clay" />
                  {place}
                </span>
              )}
              {memberSince && <span>Neighbor since {memberSince}</span>}
            </div>
          </div>
        </div>

        {profile?.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{profile.bio}</p>}
      </div>
    </section>
  );
}