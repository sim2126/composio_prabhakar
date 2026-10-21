import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ maxWidth: 720 }}>
      <h1 className="h1">No guide here yet</h1>
      <p className="lede">This app has no guide. You can generate one from the library.</p>
      <Link className="btn btn-primary" href="/" style={{ alignSelf: "flex-start" }}>
        Back to the library
      </Link>
    </main>
  );
}
