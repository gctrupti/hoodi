import { supabase } from "@/integrations/supabase/client";

const BUCKET = "profile-media";
/** ~10 years — the bucket is private, so we hand out a long-lived signed URL. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 3650;

export async function uploadProfileMedia(file: File, kind: "avatar" | "cover") {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("You need to be signed in to upload.");
  if (!file.type.startsWith("image/")) throw new Error("Please pick an image file.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${uid}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "Could not read the upload.");
  return data.signedUrl;
}