import { handleApiError, ok } from "@/lib/api/http";
import { readIncidentId } from "@/lib/api/params";
import { getIncident } from "@/lib/services/applicationops-service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return ok(await getIncident(await readIncidentId(context)));
  } catch (error) {
    return handleApiError(error);
  }
}
