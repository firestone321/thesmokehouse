import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#ECECEA]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
