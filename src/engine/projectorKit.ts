// What you need for projector mode (Cat picked K1 Fold-out, 2026-10-29), each with an Amazon search link.
// The links earn nothing until Cat joins Amazon Associates (early January 2027): then set AMAZON_TAG to her tag
// and the links carry it, with Amazon's required line under the list.
import type { Unit } from "../measurements";

export const AMAZON_TAG = "";

interface KitItem {
  name: string;
  why: string;
  optional?: boolean;
  search: string;
}

export const kit = (unit: Unit): KitItem[] => [
  {
    name: "Projector",
    why: "Any small 1080p projector. Brighter is easier in daylight.",
    search: "1080p mini projector",
  },
  {
    name: "Mount or tall stand",
    why: "So it points straight down at the table.",
    search: "projector ceiling mount overhead stand",
  },
  {
    name: "Cable",
    why: "HDMI, plus a USB-C adapter if your laptop or tablet needs one.",
    search: "HDMI cable USB-C to HDMI adapter",
  },
  {
    name: "Cutting mat with a grid",
    why: `${unit === "in" ? "24 × 18 in" : "60 × 45 cm"}. It's what you line up against.`,
    search:
      unit === "in"
        ? "self healing cutting mat 24 x 18 inch grid"
        : "self healing cutting mat 60 x 45 cm grid",
  },
  {
    name: "Pattern weights",
    why: "Keep the cloth still while you cut.",
    optional: true,
    search: "sewing pattern weights",
  },
];

/** The sewist's own Amazon: Canada, the UK or the US, read from the browser's language. */
export function amazonHost(
  language = typeof navigator === "undefined" ? "" : navigator.language,
): string {
  if (/^[a-z]{2}-CA\b/i.test(language)) return "www.amazon.ca";
  if (/^en-(GB|IE)\b/i.test(language)) return "www.amazon.co.uk";
  return "www.amazon.com";
}

export function amazonLink(
  item: KitItem,
  language?: string,
  tag = AMAZON_TAG,
): string {
  const q = new URLSearchParams({ k: item.search });
  if (tag) q.set("tag", tag);
  return `https://${amazonHost(language)}/s?${q}`;
}
