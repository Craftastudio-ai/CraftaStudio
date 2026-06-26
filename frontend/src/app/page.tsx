import Nav from "@/components/landing/nav";
import Hero from "@/components/landing/hero";
import TechStrip from "@/components/landing/tech-strip";
import Steps from "@/components/landing/steps";
import FeatureHighlight from "@/components/landing/feature-highlight";
import FeaturesGrid from "@/components/landing/features-grid";
import { WaitlistExperience } from "@/components/landing/waitlist-experience";
import FAQ from "@/components/landing/faq";
import BottomCta from "@/components/landing/bottom-cta";
import Footer from "@/components/landing/footer";
import WaitlistModal from "@/components/landing/waitlist-modal";

export const revalidate = 60;

async function getWaitlistCount(): Promise<number> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/waitlist/count`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { count?: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function LandingPage() {
  const count = await getWaitlistCount();

  return (
    <div
      className="min-h-screen text-[#f0effe] font-sans selection:bg-[#7c6fee]/30"
      style={{ background: "#07070d" }}
    >
      <Nav />
      <main>
        <Hero />
        <TechStrip />
        <Steps />
        <section className="border-b border-[#1e1e38]">
          <FeatureHighlight />
        </section>
        <FeaturesGrid />
        <WaitlistExperience count={count} />
        <FAQ />
        <BottomCta />
      </main>
      <Footer />
      <WaitlistModal />
    </div>
  );
}
