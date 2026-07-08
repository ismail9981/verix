import { Button } from "@repo/ui";
import { CTA_SECONDARY } from "../../landing/cta-styles";
import { PlusIcon } from "../icons";
import { LOCATIONS } from "./mock-data";
import { ProfileSection } from "./profile-section";
import { StatusBadge } from "./status-badge";

export function Locations() {
  return (
    <ProfileSection
      id="locations"
      title="Locations"
      description="The physical places customers can book. Add each branch or studio."
      flush
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm text-muted">{LOCATIONS.length} locations</span>
        <Button
          type="button"
          size="sm"
          className={CTA_SECONDARY}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          Add location
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Business locations</caption>
          <thead>
            <tr className="border-y border-hairline text-left text-xs text-muted">
              <th scope="col" className="px-5 py-2.5 font-medium">Name</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Address</th>
              <th scope="col" className="px-5 py-2.5 font-medium">City</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {LOCATIONS.map((location) => (
              <tr
                key={location.id}
                className="border-b border-hairline transition-colors last:border-0 hover:bg-canvas/50"
              >
                <td className="whitespace-nowrap px-5 py-3 font-medium text-white">
                  {location.name}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{location.address}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{location.city}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={location.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  );
}
