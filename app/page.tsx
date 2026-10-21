import { Library } from "@/components/Library";
import { libraryRows } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await libraryRows();
  return (
    <main className="wrap lib-main">
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 className="h1">OAuth app readiness</h1>
        <p className="lede">What it takes to get each provider&apos;s OAuth app approved, how long it takes, and what to do first.</p>
      </section>
      <Library rows={rows} />
    </main>
  );
}
