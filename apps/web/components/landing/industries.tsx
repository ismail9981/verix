import {
  ClinicIcon,
  GymIcon,
  RealEstateIcon,
  RestaurantIcon,
  SalonIcon,
  TourismIcon,
} from "./icons";
import { IndustryCard, type IndustryCardProps } from "./industry-card";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const INDUSTRIES: IndustryCardProps[] = [
  {
    icon: TourismIcon,
    title: "Tourism",
    description: "Sell tours and manage trip bookings.",
  },
  {
    icon: RealEstateIcon,
    title: "Real Estate",
    description: "Showcase listings and schedule viewings.",
  },
  {
    icon: ClinicIcon,
    title: "Medical Clinics",
    description: "Book patients and reduce no-shows.",
  },
  {
    icon: RestaurantIcon,
    title: "Restaurants",
    description: "Take reservations and online orders.",
  },
  {
    icon: SalonIcon,
    title: "Beauty Salons",
    description: "Keep your calendar full of appointments.",
  },
  {
    icon: GymIcon,
    title: "Gyms",
    description: "Manage memberships and class sign-ups.",
  },
];

export function Industries() {
  return (
    <section
      id="solutions"
      aria-labelledby="industries-heading"
      className="bg-canvas py-24 lg:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          headingId="industries-heading"
          eyebrow="Industries"
          title="Built for service businesses."
          subtitle="Designed for every modern service company."
        />
        <Reveal
          as="ul"
          className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {INDUSTRIES.map((industry) => (
            <IndustryCard key={industry.title} {...industry} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
