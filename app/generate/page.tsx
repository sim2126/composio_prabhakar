import type { Metadata } from "next";
import { Suspense } from "react";
import { Generate } from "@/components/Generate";

export const metadata: Metadata = { title: "Generate a guide" };

export default function GeneratePage() {
  return (
    <main className="wrap">
      <Suspense fallback={null}>
        <Generate />
      </Suspense>
    </main>
  );
}
