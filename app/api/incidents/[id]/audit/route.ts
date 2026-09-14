import { handleApiError, ok } from "@/lib/api/http";
import { readIncidentId } from "@/lib/api/params";
import { getAudit } from "@/lib/services/applicationops-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return ok(await getAudit(await readIncidentId(context)));
  } catch (error) {
    return handleApiError(error);
  }
}
