import { defineTemplate } from "../../define";

/*
 * Business starter — a four-page marketing site (Home, About, Services,
 * Contact) built only from section types already in the Section Registry.
 * Section `props` are partial overrides; the installer fills the rest from each
 * section's registered defaults and validates against its schema.
 */
export const businessTemplate = defineTemplate({
  key: "business",
  version: 1,
  name: "Business",
  description: "A four-page marketing site: Home, About, Services and Contact.",
  category: "business",
  thumbnail: "🏢",
  themeKey: "minimal",
  pages: [
    {
      path: "",
      title: "Home",
      sections: [
        {
          typeKey: "hero",
          props: {
            heading: "Grow your business with confidence",
            subheading:
              "Launch, take bookings, and get paid — all from one place.",
            ctaLabel: "Get started",
            ctaHref: "contact",
          },
        },
        { typeKey: "services", props: { heading: "What we offer" } },
        { typeKey: "contact", props: { heading: "Get in touch" } },
      ],
    },
    {
      path: "about",
      title: "About",
      sections: [{ typeKey: "about", props: { heading: "About us" } }],
    },
    {
      path: "services",
      title: "Services",
      sections: [{ typeKey: "services", props: { heading: "Our services" } }],
    },
    {
      path: "contact",
      title: "Contact",
      sections: [{ typeKey: "contact", props: { heading: "Contact us" } }],
    },
  ],
  metadata: { tags: ["business", "marketing", "booking"] },
});
