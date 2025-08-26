export interface PlanFeature {
  type: string;
  features: {
    name: string;
    value?: string;
  }[];
}

export const featureNames = [
  "Included Characters / Month (1M tokens ≈ 25 hours audio)",
  "Rollover (Unused Characters)",
  "Large Text Support (No Chunking)",
  "Auto Stitching + Natural Padding",
  "Single File Export (MP3 / M4B)",
  "Chapter Detection / Breaks",
  "Voice Library",
  "Commercial Use License",
  "Royal Road / Web Serial Fetch",
  "Batch Upload (Multiple Files)",
  "Pronunciation & SSML Controls",
  "Maximum Length Per Job",
  "Turnaround Speed",
  "API Access",
  "Custom Voices",
  "Priority Support",
  "Overage (per 100k chars)",
] as const;

export const planFeatures: PlanFeature[] = [
  {
    type: "Starter",
    features: [
      {
        name: "Included Characters / Month (1M tokens ≈ 25 hours audio)",
        value: "20k",
      },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Basic" },
      { name: "Voice Library", value: "5 standard" },
      { name: "Commercial Use License", value: "Non-commercial" },
      { name: "Royal Road / Web Serial Fetch", value: "—" },
      { name: "Batch Upload (Multiple Files)", value: "—" },
      { name: "Pronunciation & SSML Controls", value: "—" },
      { name: "Maximum Length Per Job", value: "10 minutes" },
      { name: "Turnaround Speed", value: "Standard" },
      { name: "API Access", value: "No" },
      { name: "Custom Voices", value: "—" },
      { name: "Priority Support", value: "Community" },
    ],
  },
  {
    type: "Basic",
    features: [
      {
        name: "Included Characters / Month (1M tokens ≈ 25 hours audio)",
        value: "1,000,000",
      },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Smart" },
      { name: "Voice Library", value: "All standard" },
      { name: "Commercial Use License", value: "Full" },
      { name: "Royal Road / Web Serial Fetch", value: "Per chapter" },
      { name: "Batch Upload (Multiple Files)" },
      { name: "Pronunciation & SSML Controls", value: "Yes" },
      { name: "Maximum Length Per Job", value: "20 hours" },
      { name: "Turnaround Speed", value: "Fast" },
      { name: "API Access", value: "Yes" },
      { name: "Custom Voices", value: "1 slot" },
      { name: "Priority Support", value: "Standard" },
      { name: "Overage (per 100k chars)", value: "$1.00" },
    ],
  },
  {
    type: "Pro",
    features: [
      {
        name: "Included Characters / Month (1M tokens ≈ 25 hours audio)",
        value: "5,000,000",
      },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Smart + TOC" },
      { name: "Voice Library", value: "Premium & multi-voice" },
      { name: "Commercial Use License", value: "Full" },
      { name: "Royal Road / Web Serial Fetch", value: "Auto-ingest" },
      { name: "Batch Upload (Multiple Files)", value: "Unlimited" },
      { name: "Pronunciation & SSML Controls", value: "Advanced profiles" },
      { name: "Maximum Length Per Job", value: "Unlimited*" },
      { name: "Turnaround Speed", value: "Priority" },
      { name: "API Access", value: "Yes" },
      { name: "Custom Voices", value: "5 slots (priority queue)" },
      { name: "Priority Support", value: "24h response" },
      { name: "Overage (per 100k chars)", value: "$1.00" },
    ],
  },
];
