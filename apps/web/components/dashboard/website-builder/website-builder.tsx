import { Reveal, RevealItem } from "../../landing/reveal";
import { DomainPanel } from "./domain-panel";
import { HeroEditor } from "./hero-editor";
import { PagesPanel } from "./pages-panel";
import { PublishHeader } from "./publish-header";
import { SectionsPanel } from "./sections-panel";
import { SeoPanel } from "./seo-panel";
import { ThemeSettings } from "./theme-settings";
import { WebsiteOverview } from "./website-overview";

/* Website Builder. Sticky publish header on top, an overview strip, then a
   two-thirds editing column (hero + sections) beside a one-third settings
   rail (pages, theme, SEO, domain). Stacks to one column on small screens. */
export function WebsiteBuilder() {
  return (
    <Reveal as="div" className="flex flex-col gap-6">
      <RevealItem>
        <PublishHeader />
      </RevealItem>
      <RevealItem>
        <WebsiteOverview />
      </RevealItem>
      <RevealItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <HeroEditor />
            <SectionsPanel />
          </div>
          <div className="flex flex-col gap-6">
            <PagesPanel />
            <ThemeSettings />
            <SeoPanel />
            <DomainPanel />
          </div>
        </div>
      </RevealItem>
    </Reveal>
  );
}
