import { describe, expect, test } from "vitest";
import { APPLE_EMOJI_CDN, appleEmojiFiles, appleEmojiUrls, isEmoji, splitEmoji } from "./emoji";

describe("appleEmojiFiles", () => {
  test("plain emoji-presentation characters have no selector", () => {
    expect(appleEmojiFiles("😄")[0]).toBe("1f604");
    expect(appleEmojiFiles("🧠")[0]).toBe("1f9e0");
  });

  test("text-default symbols gain U+FE0F", () => {
    expect(appleEmojiFiles("🗂")[0]).toBe("1f5c2-fe0f");
    expect(appleEmojiFiles("❤")[0]).toBe("2764-fe0f");
  });

  test("an existing selector is kept, not doubled", () => {
    expect(appleEmojiFiles("❤️")).toEqual(["2764-fe0f", "2764"]);
  });

  test("ZWJ sequences stay whole and qualify their inner symbols", () => {
    expect(appleEmojiFiles("🧑‍🤝‍🧑")[0]).toBe("1f9d1-200d-1f91d-200d-1f9d1");
    expect(appleEmojiFiles("🏃‍♂")[0]).toBe("1f3c3-200d-2642-fe0f");
  });

  test("skin-tone modifiers suppress the selector", () => {
    expect(appleEmojiFiles("👍🏽")[0]).toBe("1f44d-1f3fd");
  });

  test("flags are pairs of regional indicators", () => {
    expect(appleEmojiFiles("🇮🇳")[0]).toBe("1f1ee-1f1f3");
  });

  test("urls point at the pinned Apple set", () => {
    expect(appleEmojiUrls("🎓")[0]).toBe(`${APPLE_EMOJI_CDN}1f393.png`);
  });
});

describe("splitEmoji", () => {
  test("separates emoji from surrounding text", () => {
    expect(splitEmoji("Hi 👋 there")).toEqual([
      { kind: "text", value: "Hi " },
      { kind: "emoji", value: "👋" },
      { kind: "text", value: " there" },
    ]);
  });

  test("returns a single text part when there is no emoji", () => {
    expect(splitEmoji("Plan A → Plan B")).toEqual([{ kind: "text", value: "Plan A → Plan B" }]);
  });

  test("does not treat © or digits as emoji", () => {
    expect(isEmoji("©")).toBe(false);
    expect(isEmoji("7")).toBe(false);
    expect(isEmoji("7️⃣")).toBe(true);
  });
});
