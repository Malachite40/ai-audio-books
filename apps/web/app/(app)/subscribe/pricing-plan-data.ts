// Features shown in the comparison table
export const featureNames = [
  "Included Characters / Month",
  "Rollover (Unused Characters)",
  "Large Text Support (No Chunking)",
  "Auto Stitching + Natural Padding",
  "Single File Export (MP3 / M4B)",
  "Chapter Detection / Breaks",
  "Voice Library",
  "Maximum Length Per Job",
  "Turnaround Speed",
  "Hosted Player Egress",
  "Overage (per 100k chars)",
] as const;

export type PlanFeature = {
  type: "Starter" | "Basic" | "Pro" | string;
  features: { name: (typeof featureNames)[number] | string; value?: string }[];
};

export const planFeatures: PlanFeature[] = [
  {
    type: "Starter",
    features: [
      { name: "Included Characters / Month", value: "20k (~0.5 h)" },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Basic" },
      { name: "Voice Library", value: "5 standard" },
      { name: "Royal Road / Web Serial Fetch", value: "—" },
      { name: "Maximum Length Per Job", value: "10 minutes" },
      { name: "Turnaround Speed", value: "Standard" },
      { name: "Hosted Player Egress", value: "—" },
      { name: "Overage (per 100k chars)", value: "—" },
    ],
  },
  {
    type: "Basic",
    features: [
      { name: "Included Characters / Month", value: "1,000,000 (~25 h)" },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Smart" },
      { name: "Voice Library", value: "All standard" },
      { name: "Maximum Length Per Job", value: "20 hours" },
      { name: "Turnaround Speed", value: "Fast" },
      { name: "Hosted Player Egress", value: "25 GB/mo" },
      { name: "Overage (per 100k chars)", value: "$1.00" },
    ],
  },
  {
    type: "Pro",
    features: [
      { name: "Included Characters / Month", value: "5,000,000 (~125 h)" },
      { name: "Rollover (Unused Characters)", value: "Unlimited" },
      { name: "Large Text Support (No Chunking)" },
      { name: "Auto Stitching + Natural Padding" },
      { name: "Single File Export (MP3 / M4B)" },
      { name: "Chapter Detection / Breaks", value: "Smart + TOC" },
      { name: "Voice Library", value: "All standard & Premium" },
      { name: "Maximum Length Per Job", value: "Unlimited*" },
      { name: "Turnaround Speed", value: "Priority" },
      { name: "Hosted Player Egress", value: "150 GB/mo" },
      { name: "Overage (per 100k chars)", value: "$1.00" },
    ],
  },
];
