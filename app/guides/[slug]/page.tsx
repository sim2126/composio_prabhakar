import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideView } from "@/components/GuideView";
import { APPS, CAP_PRESETS as PRESETS, getGuide } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ app?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug);
  return guide ? { title: guide.name, description: guide.summary } : { title: "Guide not found" };
}

export default async function GuidePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { app } = await searchParams;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  const preset = app ? PRESETS[slug]?.[app] : undefined;
  const logo = APPS.find((a) => a.unit === slug)?.logo ?? null;
  return <GuideView guide={guide} logo={logo} initialCaps={preset ?? guide.defaultCapabilities} />;
}
