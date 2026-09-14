import { handleApiError, ok } from "@/lib/api/http";
import { readIncidentId } from "@/lib/api/params";
import { getLogs } from "@/lib/services/applicationops-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    return ok(await getLogs(await readIncidentId(context)));
  } catch (error) {
    return handleApiError(error);
  }
}
