import { Features } from "../components/landing/features";
import { Hero } from "../components/landing/hero";
import { HowItWorks } from "../components/landing/how-it-works";
import { Industries } from "../components/landing/industries";
import { Navbar } from "../components/landing/navbar";
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
      </main>
    </div>
  );
}
