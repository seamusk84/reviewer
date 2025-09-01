import { useRouter } from "next/router";

export default function EstatePage() {
  const { county, town, estate } = (useRouter().query as Record<string, string>);
  const nice = (s?: string) => (s || "").replace(/-/g, " ");

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        {nice(estate)} — {nice(town)}, {nice(county)}
      </h1>
      <p style={{ color: "#555" }}>Placeholder estate page (map, reviews, pros/cons will go here).</p>
    </div>
  );
}
