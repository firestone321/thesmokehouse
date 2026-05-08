import type { MetadataRoute } from "next";
import { getSeoSiteOrigin } from "@/lib/site-url";

const siteOrigin = getSeoSiteOrigin();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/cart", "/checkout", "/offline", "/order", "/payment"]
      }
    ],
    sitemap: `${siteOrigin}/sitemap.xml`
  };
}
