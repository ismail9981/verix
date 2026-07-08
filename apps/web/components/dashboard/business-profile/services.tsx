import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { SERVICES } from "./mock-data";
import { ProfileSection } from "./profile-section";
import { StatusBadge } from "./status-badge";

export function Services() {
  return (
    <ProfileSection
      id="services"
      title="Services"
      description="The bookable services you offer, with duration and price."
      flush
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm text-muted">{SERVICES.length} services</span>
        <Button
          type="button"
          size="sm"
          className={CTA_SECONDARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add service
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Services offered</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className="px-5 py-2.5 font-medium">Service name</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Duration</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Price</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {SERVICES.map((service) => (
              <tr
                key={service.id}
                className="border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
              >
                <td className="whitespace-nowrap px-5 py-3 font-medium text-white">
                  {service.name}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{service.duration}</td>
                <td className="whitespace-nowrap px-5 py-3 text-white">{service.price}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={service.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  );
}
