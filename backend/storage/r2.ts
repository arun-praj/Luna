import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export function r2Configured() {
  return Boolean(process.env.R2_BUCKET_NAME && endpoint && accessKeyId && secretAccessKey);
}

export function r2Bucket() {
  return process.env.R2_BUCKET_NAME ?? "";
}

export function r2Client() {
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("R2 storage is not configured");
  return new S3Client({ region: process.env.R2_REGION ?? "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
}
