import { serverClient } from "./supabase/server";
import { isConfigured } from "./supabase/config";
import { createRepository } from "./repository";
import { HttpError, type RequestContext } from "./http";
export async function requestContext(): Promise<RequestContext | null> {
  if (!isConfigured())
    throw new HttpError(
      503,
      "Add your Supabase environment variables to connect inventory storage.",
    );
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return { userId: user.id, repository: createRepository(client, user.id) };
}
