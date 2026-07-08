import { Faq } from "../components/landing/faq";
import { Features } from "../components/landing/features";
import { FinalCta } from "../components/landing/final-cta";
import { Footer } from "../components/landing/footer";
import { Hero } from "../components/landing/hero";
import { HowItWorks } from "../components/landing/how-it-works";
import { Industries } from "../components/landing/industries";
import { Navbar } from "../components/landing/navbar";
import { Pricing } from "../components/landing/pricing";
import { TrustedBy } from "../components/landing/trusted-by";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <Industries />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
