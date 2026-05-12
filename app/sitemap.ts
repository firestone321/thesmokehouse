import type { MetadataRoute } from "next";
import { getSeoSiteOrigin } from "@/lib/site-url";

const siteOrigin = getSeoSiteOrigin();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${siteOrigin}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteOrigin}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6
    },
    {
      url: `${siteOrigin}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: `${siteOrigin}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];
}
