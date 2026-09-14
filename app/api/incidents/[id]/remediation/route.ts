import { handleApiError, ok } from "@/lib/api/http";
import { readJsonBody } from "@/lib/api/body";
import { readIncidentId } from "@/lib/api/params";
import { remediationBodySchema } from "@/lib/api/schemas";
import { selectIncidentRemediation } from "@/lib/services/applicationops-service";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const id = await readIncidentId(context);
    const body = remediationBodySchema.parse(await readJsonBody(request));
    return ok(await selectIncidentRemediation(id, body.action));
  } catch (error) {
    return handleApiError(error);
  }
}
