import { z } from "zod";

const incidentIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export async function readIncidentId(context: { params: Promise<{ id: string }> }): Promise<string> {
  const params = await context.params;
  return incidentIdSchema.parse(params.id);
}
