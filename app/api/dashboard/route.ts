import { handleApiError, ok } from "@/lib/api/http";
import { getDashboard } from "@/lib/services/applicationops-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getDashboard());
  } catch (error) {
    return handleApiError(error);
  }
}
