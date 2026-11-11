import { Redis } from "@upstash/redis";
import { createRoscoMailReviewStore } from "@/lib/roscoMailReviewStoreCore";

export * from "@/lib/roscoMailReviewStoreCore";

const reviewStore = createRoscoMailReviewStore(Redis.fromEnv());
export const enqueueRoscoMailReviewTask = reviewStore.enqueue;
export const listRoscoMailReviewTasks = reviewStore.list;
export const getRoscoMailReviewTask = reviewStore.get;
