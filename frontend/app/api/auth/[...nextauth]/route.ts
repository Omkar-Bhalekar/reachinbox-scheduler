import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Google's stable per-user id - this becomes our link to the backend User row.
      if (account && profile) {
        token.googleId = account.providerAccountId;
        token.picture = (profile as any).picture;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.googleId = token.googleId;
        session.user.image = token.picture || session.user.image;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
