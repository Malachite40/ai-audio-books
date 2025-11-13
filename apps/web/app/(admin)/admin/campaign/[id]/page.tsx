import { CampaignClientPage } from "./campaign.client";

type RouteParams = Promise<{ id: string }>;

export default async function AdminCampaignPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  return (
    <div className="container mx-auto py-6">
      <CampaignClientPage campaignId={id} />
    </div>
  );
}
