import type { Item } from "@/lib/queries/library";

export const TYPE_LABELS: Record<Item["type"], string> = {
  article: "Article",
  course: "Course",
  video: "Video",
  tool: "Tool",
  idea: "Idea",
  note: "Note",
  tweet: "Post",
  other: "Link",
};

export const STATUS_LABELS: Record<Item["status"], string> = {
  unread: "To read",
  read: "Read",
  done: "Done",
};
