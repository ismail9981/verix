import { Hero } from "../components/landing/hero";
import { Navbar } from "../components/landing/navbar";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}
