import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";
export const s3Client = new S3Client({
  region: "auto",
  endpoint: env.CLOUD_FLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: env.CLOUD_FLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUD_FLARE_SECRET_ACCESS_KEY,
  },
});

export async function uploadFileToS3(
  file: File,
  presignedPost: {
    url: string;
    fields: {
      [x: string]: string;
    };
  },
  imageId: string
) {
  const { url, fields } = presignedPost;
  const data: Record<string, any> = {
    ...fields,
    "Content-Type": file.type,
    file,
  };
  const formData = new FormData();
  for (const name in data) {
    formData.append(name, data[name]);
  }
  const upload_response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (upload_response.status !== 204) {
    throw new Error("failed to upload image");
  }

  return {
    imageId,
  };
}
