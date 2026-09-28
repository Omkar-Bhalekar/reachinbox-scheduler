import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),

    CredentialsProvider({
      name: "Credentials",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const response = await fetch(
            `${BACKEND_URL}/api/auth/login`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            },
          );

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          if (!data?.user || !data?.token) {
            return null;
          }

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name,
            image: data.user.avatar || null,

            // Backend JWT used by apiClient.
            backendToken: data.token,

            // Password users don't have a Google ID.
            googleId: null,
          };
        } catch (error) {
          console.error(
            "Credentials authentication failed:",
            error,
          );

          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile, user }) {
      /*
       * Google OAuth login
       */
      if (account?.provider === "google" && profile) {
        token.googleId = account.providerAccountId;
        token.picture = (profile as any).picture;
      }

      /*
       * Email/password login
       */
      if (account?.provider === "credentials" && user) {
        token.backendToken = (user as any).backendToken;
        token.googleId = null;
        token.picture = user.image;
        token.userId = user.id;
      }

      return token;
    },

    async session({ session, token }: any) {
      if (session.user) {
        session.user.googleId = token.googleId || null;
        session.user.image =
          token.picture || session.user.image;

        session.user.backendToken =
          token.backendToken || null;

        session.user.id =
          token.userId || session.user.id;
      }

      return session;
    },
  },

  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };