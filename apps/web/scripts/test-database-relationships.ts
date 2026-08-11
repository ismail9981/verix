import {
  assertRelationshipPreflightSafe,
  runRelationshipPreflight,
} from "../src/test/database/relationships/relationship-preflight";
import { withTestDatabase } from "../src/test/database/test-database";

const report = await withTestDatabase((client) =>
  runRelationshipPreflight(client),
);
assertRelationshipPreflightSafe(report);

console.log(
  JSON.stringify({
    safe: report.safe,
    relationshipCount: report.relationshipCount,
    missingParentCount: report.missingParentCount,
    crossWorkspaceCount: report.crossWorkspaceCount,
    ownershipPathAnomalyCount: report.ownershipPathAnomalyCount,
  }),
);
