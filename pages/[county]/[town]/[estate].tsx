import { useRouter } from "next/router";

export default function EstatePage() {
  const router = useRouter();
  const { county, town, estate } = router.query as Record<string, string>;
  const nice = (s?: string) => (s || "").replace(/-/g, " ");

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        {nice(estate)} — {nice(town)}, {nice(county)}
      </h1>
      <p style={{ color: "#555" }}>
        Placeholder estate page. We can add a map, reviews, pros/cons, schools, commute, etc.
      </p>
      <hr style={{ margin: "20px 0" }} />
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Recent reviews</h2>
      <p>No reviews yet.</p>
    </div>
  );
}
