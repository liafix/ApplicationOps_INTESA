import { handleApiError, ok } from "@/lib/api/http";
import { resetDemo } from "@/lib/services/applicationops-service";

export async function POST() {
  try {
    return ok(await resetDemo());
  } catch (error) {
    return handleApiError(error);
  }
}
