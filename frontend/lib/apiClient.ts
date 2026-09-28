import axios from "axios";
import { getSession } from "next-auth/react";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000",
});

// Forwards the already-verified Google identity from NextAuth's session to
// the backend on every call, so the backend can upsert/attach the matching
// User row without re-implementing OAuth server-side.
apiClient.interceptors.request.use(async (requestConfig) => {
  const session = await getSession();
  const user = session?.user as any;
  if (user) {
    requestConfig.headers["x-user-google-id"] = user.googleId || "";
    requestConfig.headers["x-user-email"] = user.email || "";
    requestConfig.headers["x-user-name"] = user.name || "";
    if (user.image) requestConfig.headers["x-user-avatar"] = user.image;
  }
  return requestConfig;
});
