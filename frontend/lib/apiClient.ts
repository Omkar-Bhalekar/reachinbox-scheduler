import axios from "axios";
import { getSession } from "next-auth/react";

export const apiClient = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:4000",
});

apiClient.interceptors.request.use(async (requestConfig) => {
  const session = await getSession();
  const user = session?.user as any;

  if (user) {
    // Password-authenticated users
    // receive a JWT from the backend.
    if (user.backendToken) {
      requestConfig.headers.Authorization =
        `Bearer ${user.backendToken}`;
    }

    // Google-authenticated users continue using
    // the existing Google identity headers.
    if (user.googleId) {
      requestConfig.headers["x-user-google-id"] =
        user.googleId;
    }

    if (user.email) {
      requestConfig.headers["x-user-email"] =
        user.email;
    }

    if (user.name) {
      requestConfig.headers["x-user-name"] =
        user.name;
    }

    if (user.image) {
      requestConfig.headers["x-user-avatar"] =
        user.image;
    }
  }

  return requestConfig;
});