"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { useSession } from "next-auth/react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Sidebar from "@/components/layout/Sidebar";
import { apiClient } from "@/lib/apiClient";
import type { EmailRecord } from "@/types/api";

export default function EmailDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();

  const emailId = params?.id as string;

  const [email, setEmail] =
    useState<EmailRecord | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [slackConnected, setSlackConnected] =
    useState(false);

  const [slackTeamName, setSlackTeamName] =
    useState<string | null>(null);

  const [slackLoading, setSlackLoading] =
    useState(true);

  useEffect(() => {
    if (!emailId) return;

    const fetchEmail = async () => {
      setLoading(true);

      try {
        const res = await apiClient.get(
          `/api/emails/${encodeURIComponent(
            emailId,
          )}`,
        );

        setEmail(res.data.email);
      } catch (error) {
        console.error(
          "Failed to fetch email:",
          error,
        );

        setEmail(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [emailId]);

  useEffect(() => {
    const fetchSlackStatus = async () => {
      setSlackLoading(true);

      try {
        const res = await apiClient.get(
          "/api/auth/whoami",
        );

        setSlackConnected(
          Boolean(
            res.data.user.slackConnected,
          ),
        );

        setSlackTeamName(
          res.data.user.slackTeamName ||
            null,
        );
      } catch (error) {
        console.error(
          "Failed to fetch Slack status:",
          error,
        );

        setSlackConnected(false);
        setSlackTeamName(null);
      } finally {
        setSlackLoading(false);
      }
    };

    fetchSlackStatus();
  }, []);

  const connectSlack = async () => {
    try {
      setSlackLoading(true);

      const res = await apiClient.post(
        "/api/auth/slack/connect",
      );

      window.location.href =
        res.data.authorizeUrl;
    } catch (error: any) {
      console.error(
        "Slack connect failed:",
        error,
      );

      alert(
        error?.response?.data?.error ||
          "Unable to connect Slack. Please try again.",
      );

      setSlackLoading(false);
    }
  };

  const disconnectSlack = async () => {
    const confirmed = window.confirm(
      "Disconnect Slack? You will no longer receive hourly rate-limit notifications.",
    );

    if (!confirmed) return;

    try {
      setSlackLoading(true);

      await apiClient.post(
        "/api/auth/slack/disconnect",
      );

      setSlackConnected(false);
      setSlackTeamName(null);
    } catch (error: any) {
      console.error(
        "Slack disconnect failed:",
        error,
      );

      alert(
        error?.response?.data?.error ||
          "Unable to disconnect Slack. Please try again.",
      );
    } finally {
      setSlackLoading(false);
    }
  };

  const formatDate = (
    date: string | null,
  ) => {
    if (!date) return "—";

    return new Date(date).toLocaleString(
      [],
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    );
  };

  const getInitial = (
    value: string,
  ) => {
    return (
      value?.charAt(0)?.toUpperCase() ||
      "?"
    );
  };

  const getStatusStyle = (
    status: string,
  ) => {
    const styles: Record<
      string,
      string
    > = {
      SENT:
        "bg-[#ECFDF3] text-[#16834B]",
      SCHEDULED:
        "bg-[#F0F0FF] text-[#5C5CEB]",
      PROCESSING:
        "bg-[#FFF7E6] text-[#B7791F]",
      RATE_LIMITED:
        "bg-[#FFF4E5] text-[#C76A00]",
      FAILED:
        "bg-[#FEF2F2] text-[#C53030]",
    };

    return (
      styles[status] ||
      "bg-[#F3F3F3] text-[#666666]"
    );
  };

  const activeTab: "scheduled" | "sent" =
    email?.status === "SENT"
      ? "sent"
      : "scheduled";

  const handleBack = () => {
    router.push(
      email?.status === "SENT"
        ? "/dashboard?tab=sent"
        : "/dashboard?tab=scheduled",
    );
  };

  return (
    <DashboardLayout
      sidebar={
        <Sidebar
          session={session}
          activeTab={activeTab}
          onTabChange={(tab) => {
            router.push(
              tab === "sent"
                ? "/dashboard?tab=sent"
                : "/dashboard?tab=scheduled",
            );
          }}
          onCompose={() =>
            router.push("/dashboard")
          }
          slackConnected={slackConnected}
          slackTeamName={slackTeamName}
          slackLoading={slackLoading}
          onConnectSlack={connectSlack}
          onDisconnectSlack={
            disconnectSlack
          }
          onLogout={() =>
            router.push("/")
          }
        />
      }
    >
      <div className="flex h-full flex-col bg-[#F7F7F8]">

        {/* Header */}
        <header className="flex h-[72px] shrink-0 items-center border-b border-[#E8E8E8] bg-white px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-lg text-[#555555] transition hover:bg-[#F7F7F7]"
              title="Back"
            >
              ←
            </button>

            <div>
              <p className="text-sm font-semibold text-[#222222]">
                Email details
              </p>

              <p className="mt-0.5 text-xs text-[#999999]">
                View email information
              </p>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto px-8 py-8">
          {loading ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <div className="text-sm text-[#888888]">
                Loading email...
              </div>
            </div>
          ) : !email ? (
            <div className="flex h-full min-h-[400px] items-center justify-center">
              <div className="rounded-xl border border-[#E5E5E5] bg-white px-10 py-8 text-center shadow-sm">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F2F2] text-xl">
                  ✉
                </div>

                <p className="text-sm font-semibold text-[#333333]">
                  Email not found
                </p>

                <p className="mt-1 text-xs text-[#999999]">
                  This email may have been
                  removed or you may not have
                  access to it.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/dashboard",
                    )
                  }
                  className="mt-5 rounded-lg bg-[#5C5CEB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4F4FDB]"
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[980px]">
              <article className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-sm">

                {/* Subject */}
                <div className="border-b border-[#EEEEEE] px-7 py-6">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1E1E1E]">
                        {email.subject}
                      </h1>

                      <div className="mt-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getStatusStyle(
                            email.status,
                          )}`}
                        >
                          {email.status}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs text-[#999999]">
                        {email.status ===
                        "SENT"
                          ? "Sent"
                          : "Scheduled"}
                      </p>

                      <p className="mt-1 text-xs font-medium text-[#555555]">
                        {email.status ===
                        "SENT"
                          ? formatDate(
                              email.sentAt,
                            )
                          : formatDate(
                              email.scheduledAt,
                            )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sender */}
                <div className="border-b border-[#EEEEEE] px-7 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAEAFF] text-sm font-semibold text-[#5C5CEB]">
                      {getInitial(
                        email.senderEmail,
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-semibold text-[#222222]">
                          {email.senderEmail}
                        </p>

                        <span className="text-xs text-[#AAAAAA]">
                          to
                        </span>

                        <p className="text-sm text-[#555555]">
                          {email.to}
                        </p>
                      </div>

                      <p className="mt-1 text-xs text-[#999999]">
                        {email.status ===
                        "SENT"
                          ? formatDate(
                              email.sentAt,
                            )
                          : `Scheduled for ${formatDate(
                              email.scheduledAt,
                            )}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-7 py-8">
                  <div className="max-w-[760px]">
                    <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#333333]">
                      {email.body}
                    </div>
                  </div>
                </div>

                {/* Error */}
                {email.error && (
                  <div className="border-t border-[#F5DADA] bg-[#FFF8F8] px-7 py-5">
                    <p className="text-xs font-semibold text-[#C53030]">
                      Error
                    </p>

                    <p className="mt-1 text-sm text-[#9B2C2C]">
                      {email.error}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-[#EEEEEE] bg-[#FAFAFA] px-7 py-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#AAAAAA]">
                        Recipient
                      </p>

                      <p className="mt-1 truncate text-xs text-[#555555]">
                        {email.to}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#AAAAAA]">
                        Scheduled
                      </p>

                      <p className="mt-1 text-xs text-[#555555]">
                        {formatDate(
                          email.scheduledAt,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#AAAAAA]">
                        Sent
                      </p>

                      <p className="mt-1 text-xs text-[#555555]">
                        {formatDate(
                          email.sentAt,
                        )}
                      </p>
                    </div>

                  </div>
                </div>
              </article>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}