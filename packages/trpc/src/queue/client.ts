import { createClient } from "celery-node"

const globalForClient = global as unknown as { client: any }

export const client = createClient(process.env.BROKER, process.env.REDIS_URL)

if (process.env.NODE_ENV !== "production") globalForClient.client = client
