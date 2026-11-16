/** Shared (server + client) copy for list kinds. Must not live in a "use client" module:
 * server components importing a value from one receive a client reference, not the object. */
export type ListKind = "watchlist" | "people" | "generic";
export type EntryStatus = "todo" | "doing" | "done";

export const KIND_COPY: Record<ListKind, { status: Record<EntryStatus, string>; subtitle: string; title: string; emoji: string }> = {
  watchlist: { status: { todo: "To watch", doing: "Watching", done: "Watched" }, subtitle: "Movie, series, anime, book…", title: "Title", emoji: "🎬" },
  people: { status: { todo: "Reach out", doing: "In touch", done: "Connected" }, subtitle: "Who they are — role, where you met", title: "Name", emoji: "🧑‍🤝‍🧑" },
  generic: { status: { todo: "To do", doing: "Doing", done: "Done" }, subtitle: "Detail", title: "Title", emoji: "📋" },
};
