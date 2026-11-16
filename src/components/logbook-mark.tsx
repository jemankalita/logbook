/**
 * The app mark, drawn with plain elements so next/og can render it to PNG:
 * a book on a dark tile with a small green "done" dot — logbook + progress.
 */
export function LogbookMark({ size }: { size: number }) {
  const u = size / 16;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0c0e" }}>
      <div style={{ position: "relative", display: "flex", width: 9 * u, height: 11 * u, borderRadius: 1.2 * u, background: "#8098ff" }}>
        <div style={{ position: "absolute", left: 1.6 * u, top: 0, bottom: 0, width: 0.5 * u, background: "rgba(0,0,0,0.25)" }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: 3.2 * u, top: (3 + i * 1.8) * u, width: (4 - i * 0.8) * u, height: 0.7 * u, borderRadius: 0.35 * u, background: "#ffffff" }} />
        ))}
        <div style={{ position: "absolute", right: -1.6 * u, bottom: -1.6 * u, width: 3.6 * u, height: 3.6 * u, borderRadius: 999, background: "#3ecf8e", border: `${0.6 * u}px solid #0b0c0e` }} />
      </div>
    </div>
  );
}
