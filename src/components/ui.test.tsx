import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cls } from "./cls";
import { Favicon, LinkCover } from "./library/link-cover";
import { NotFoundCard } from "./not-found-card";
import { CardHeader, PageHeader, Progress } from "./page-ui";
import { ThemeToggle } from "./theme-toggle";

const link = { url: "https://www.refactoringui.com/book", title: "Refactoring UI", favicon: null, image: null };

describe("LinkCover", () => {
  it("shows the page's preview image when it has one", () => {
    const html = renderToStaticMarkup(<LinkCover item={{ ...link, image: "https://example.com/og.png" }} />);
    expect(html).toContain('src="https://example.com/og.png"');
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("draws a cover from the site when there is no image", () => {
    const html = renderToStaticMarkup(<LinkCover item={link} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("refactoringui.com"); // hostname, without www.
    expect(html).toContain("color-mix(in oklab");
  });

  it("gives the same site the same tint every time, and different sites different tints", () => {
    const tint = (url: string) => /background-color:([^;"]+)/.exec(renderToStaticMarkup(<LinkCover item={{ ...link, url }} />))?.[1];
    expect(tint("https://a.example/1")).toBe(tint("https://a.example/2"));
    const tints = new Set(["https://github.com", "https://vercel.com", "https://linear.app", "https://stripe.com"].map(tint));
    expect(tints.size).toBeGreaterThan(1);
  });

  it("falls back to a generic label for an item without a URL", () => {
    expect(renderToStaticMarkup(<LinkCover item={{ ...link, url: null }} />)).toContain("Saved link");
  });
});

describe("Favicon", () => {
  it("uses the site's first letter when there is no icon", () => {
    const html = renderToStaticMarkup(<Favicon item={link} />);
    expect(html).toContain(">R<");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the icon image when there is one", () => {
    expect(renderToStaticMarkup(<Favicon item={{ ...link, favicon: "https://refactoringui.com/favicon.ico" }} />)).toContain('src="https://refactoringui.com/favicon.ico"');
  });
});

describe("ThemeToggle", () => {
  it("offers the opposite theme with an accessible name", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="dark" className="x" />);
    expect(html).toContain('aria-label="Switch to light theme"');
    expect(renderToStaticMarkup(<ThemeToggle initial="light" className="x" />)).toContain('aria-label="Switch to dark theme"');
  });

  it("uses its visible text as the name when labelled", () => {
    const html = renderToStaticMarkup(<ThemeToggle initial="dark" className="x" withLabel />);
    expect(html).toContain("Light theme");
    expect(html).not.toContain("aria-label=");
  });
});

describe("page building blocks", () => {
  it("PageHeader renders one h1 with eyebrow, description and actions", () => {
    const html = renderToStaticMarkup(<PageHeader eyebrow="Goals" title="Paths" description="Long-term roadmaps" actions={<button type="button">New</button>} />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Goals");
    expect(html).toContain("Long-term roadmaps");
    expect(html).toContain("<button");
  });

  it("CardHeader links out with a touch target of at least 24px", () => {
    const html = renderToStaticMarkup(<CardHeader title="Today" href="/tasks" linkLabel="Tasks" />);
    expect(html).toContain('href="/tasks"');
    expect(html).toContain("h-6");
  });

  it("Progress exposes its value to assistive tech and clamps overflow", () => {
    const html = renderToStaticMarkup(<Progress value={7} max={5} label="Done today" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Done today"');
    expect(html).toContain("scaleX(1)");
  });

  it("NotFoundCard explains the 404 and links home", () => {
    const html = renderToStaticMarkup(<NotFoundCard />);
    expect(html).toContain("<h1");
    expect(html).toContain('href="/"');
  });

  it("the emoji input class does not stretch to full width", () => {
    expect(cls.inputEmoji).not.toContain("w-full");
    expect(cls.inputEmoji).toContain("w-12");
    expect(cls.input).toContain("w-full");
  });
});
