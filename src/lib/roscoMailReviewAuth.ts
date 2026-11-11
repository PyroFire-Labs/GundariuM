import { getSessionAddress, SESSION_COOKIE_NAME } from "@/lib/auth";
import { createRoscoOwnerAuthorizer } from "@/lib/roscoMailReviewAuthCore";

export const requireRoscoOwner = createRoscoOwnerAuthorizer({
  getOwnerAddress: () => process.env.ROSCO_OWNER_ADDRESS,
  getSessionAddress,
  sessionCookieName: SESSION_COOKIE_NAME,
});
