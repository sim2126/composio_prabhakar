import { Guide } from "@/lib/guide";
import pipedrive from "./pipedrive.json";
import resend from "./resend.json";
import reddit from "./reddit.json";
import close from "./close.json";
import clio from "./clio.json";
import procore from "./procore.json";
import calendly from "./calendly.json";

// Agent-generated guides captured during testing, shipped so a fresh deployment has examples.
// They stay labelled as generated (not human-reviewed). The live store takes precedence.
const RAW: Record<string, unknown> = {
  "pipedrive": pipedrive,
  "resend": resend,
  "reddit": reddit,
  "close": close,
  "clio": clio,
  "procore": procore,
  "calendly": calendly,
};

export const SNAPSHOTS: Record<string, Guide> = Object.fromEntries(Object.entries(RAW).map(([slug, g]) => [slug, Guide.parse(g)]));
