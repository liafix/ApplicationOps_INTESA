import { z } from "zod";

export const remediationBodySchema = z.object({
  action: z.enum([
    "RETRY_FAILED_TRANSACTIONS",
    "CHANGE_PRODUCTION_DATA",
    "ROLLBACK_RELEASE",
    "ESCALATE_WITHOUT_ACTION"
  ])
}).strict();
