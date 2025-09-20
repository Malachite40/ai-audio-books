import { EmailCaptureForm } from "@/components/email-capture-form";
import { Card, CardContent } from "@workspace/ui/components/card";

export default async function Page() {
  // Center of screen coming soon
  return (
    <div className="flex items-center justify-center flex-1 flex-col p-6 text-center gap-6">
      <h1 className="text-3xl font-medium">
        Our <span className="text-primary">Free</span> Library is coming soon.
      </h1>

      <Card className="max-w-xl">
        <CardContent>
          <EmailCaptureForm
            title="Get Notified!"
            description="We're launching our free library soon. Sign up to be the first to know when we go live!"
            group="public-library"
          />
        </CardContent>
      </Card>
    </div>
  );
}
