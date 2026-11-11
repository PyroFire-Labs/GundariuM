import { requireRoscoOwner } from "@/lib/roscoMailReviewAuth";
import { createRoscoMailReviewHandlers } from "@/lib/roscoMailReviewHandlers";
import {
  getRoscoMailReviewTask,
  listRoscoMailReviewTasks,
} from "@/lib/roscoMailReviewStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createRoscoMailReviewHandlers({
  authorize: requireRoscoOwner,
  listTasks: listRoscoMailReviewTasks,
  getTask: getRoscoMailReviewTask,
  getApiKey: () => process.env.AGENTMAIL_API_KEY,
  fetchMessage: (...args) => fetch(...args),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const { taskId } = await context.params;
  return handlers.fetchMessage(request, taskId);
}
