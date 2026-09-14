import { handleApiError, ok } from "@/lib/api/http";
import { readIncidentId } from "@/lib/api/params";
import { runIncidentValidation } from "@/lib/services/applicationops-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    return ok(await runIncidentValidation(await readIncidentId(context)));
  } catch (error) {
    return handleApiError(error);
  }
}
