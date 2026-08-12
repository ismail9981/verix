import {
  assertIdentityLinkagePreflightSafe,
  runIdentityLinkagePreflight,
} from "../src/test/database/identity/identity-preflight";
import { withTestDatabase } from "../src/test/database/test-database";

const report = await withTestDatabase(runIdentityLinkagePreflight);
assertIdentityLinkagePreflightSafe(report);
console.log(JSON.stringify(report));
