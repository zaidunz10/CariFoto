import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { fetchSessionSitemapEntries } from "@/lib/supabase-server";

const BASE_URL = "https://cari-foto.vercel.app";

async function getCachedSessionEntries() {
  "use cache";
  cacheLife("hours");

  return fetchSessionSitemapEntries();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sessions = await getCachedSessionEntries();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const sessionEntries: MetadataRoute.Sitemap = sessions.map((session) => ({
    url: `${BASE_URL}/session/${session.id}`,
    lastModified: session.created_at ? new Date(session.created_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...sessionEntries];
}
