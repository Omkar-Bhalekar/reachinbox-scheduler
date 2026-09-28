"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:4000";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isRegistering, setIsRegistering] =
    useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleCredentialsSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isRegistering && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (isRegistering && password.length < 8) {
      setError(
        "Password must be at least 8 characters.",
      );
      return;
    }

    setLoading(true);

    try {
      if (isRegistering) {
        const response = await fetch(
          `${BACKEND_URL}/api/auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: name.trim(),
              email: trimmedEmail,
              password,
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to create your account.",
          );
        }
      }

      const result = await signIn("credentials", {
        email: trimmedEmail,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError(
          isRegistering
            ? "Account created, but automatic sign-in failed. Please sign in manually."
            : "Invalid email or password.",
        );

        if (isRegistering) {
          setIsRegistering(false);
          setPassword("");
        }

        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error(
        "Authentication failed:",
        error,
      );

      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      await signIn("google", {
        callbackUrl: "/dashboard",
      });
    } catch (error) {
      console.error(
        "Google sign-in failed:",
        error,
      );

      setError(
        "Unable to sign in with Google. Please try again.",
      );

      setGoogleLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegistering((current) => !current);
    setError("");
    setPassword("");
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F8]">
        <div className="text-sm text-[#777777]">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F8] px-4">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5C5CEB] text-sm font-bold text-white">
                O
              </div>

              <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">
                outbox
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#171717]">
              {isRegistering
                ? "Create your account"
                : "Welcome back"}
            </h1>

            <p className="mt-2 text-sm text-[#888888]">
              {isRegistering
                ? "Create an account to start scheduling emails."
                : "Sign in to continue to your email scheduler."}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleCredentialsSubmit}
            className="space-y-4"
          >
            {isRegistering && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-[#333333]"
                >
                  Name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-11 w-full rounded-lg border border-[#E1E1E1] bg-white px-3.5 text-sm text-[#222222] outline-none transition placeholder:text-[#A5A5A5] focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[#333333]"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                autoComplete="email"
                className="h-11 w-full rounded-lg border border-[#E1E1E1] bg-white px-3.5 text-sm text-[#222222] outline-none transition placeholder:text-[#A5A5A5] focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[#333333]"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder={
                  isRegistering
                    ? "At least 8 characters"
                    : "Enter your password"
                }
                autoComplete={
                  isRegistering
                    ? "new-password"
                    : "current-password"
                }
                className="h-11 w-full rounded-lg border border-[#E1E1E1] bg-white px-3.5 text-sm text-[#222222] outline-none transition placeholder:text-[#A5A5A5] focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-[#F3C7C7] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#C53030]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-[#5C5CEB] text-sm font-semibold text-white transition hover:bg-[#4D4DDA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? isRegistering
                  ? "Creating account..."
                  : "Signing in..."
                : isRegistering
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#EEEEEE]" />

            <span className="text-xs text-[#999999]">
              OR
            </span>

            <div className="h-px flex-1 bg-[#EEEEEE]" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-[#E1E1E1] bg-white text-sm font-medium text-[#333333] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-base font-semibold">
              G
            </span>

            {googleLoading
              ? "Connecting..."
              : "Continue with Google"}
          </button>

          {/* Switch auth mode */}
          <div className="mt-6 text-center text-sm text-[#777777]">
            {isRegistering
              ? "Already have an account?"
              : "Don't have an account?"}

            <button
              type="button"
              onClick={switchMode}
              className="ml-1 font-semibold text-[#5C5CEB] hover:underline"
            >
              {isRegistering
                ? "Sign in"
                : "Create account"}
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#A0A0A0]">
          ReachInbox Email Scheduler
        </p>
      </div>
    </main>
  );
}