"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import ComposeModal from "@/components/ComposeModal";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Sidebar from "@/components/layout/Sidebar";
import EmailRow from "@/components/email/EmailRow";

import { apiClient } from "@/lib/apiClient";
import type { EmailRecord } from "@/types/api";

function DashboardContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<
    "scheduled" | "sent"
  >("scheduled");

  const [isComposeOpen, setIsComposeOpen] =
    useState(false);

  const [rows, setRows] = useState<EmailRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searching, setSearching] =
    useState(false);

  const [slackConnected, setSlackConnected] =
    useState(false);

  const [slackTeamName, setSlackTeamName] =
    useState<string | null>(null);

  const [slackLoading, setSlackLoading] =
    useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);

    try {
      const status =
        activeTab === "scheduled"
          ? "SCHEDULED,PROCESSING,RATE_LIMITED"
          : "SENT";

      const res = await apiClient.get(
        `/api/emails?status=${encodeURIComponent(
          status,
        )}`,
      );

      setRows(res.data.items);
    } catch (error) {
      console.error(
        "Failed to fetch emails:",
        error,
      );

      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const searchEmails = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        await fetchEmails();
        return;
      }

      setSearching(true);

      try {
        const res = await apiClient.get(
          `/api/emails/search?q=${encodeURIComponent(
            trimmedQuery,
          )}`,
        );

        let results: EmailRecord[] =
          res.data.items || [];

        if (activeTab === "scheduled") {
          results = results.filter((email) =>
            [
              "SCHEDULED",
              "PROCESSING",
              "RATE_LIMITED",
            ].includes(email.status),
          );
        } else {
          results = results.filter(
            (email) => email.status === "SENT",
          );
        }

        setRows(results);
      } catch (error) {
        console.error(
          "Email search failed:",
          error,
        );

        setRows([]);
      } finally {
        setSearching(false);
      }
    },
    [activeTab, fetchEmails],
  );

  const fetchSlackStatus = useCallback(
    async () => {
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
    },
    [],
  );

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (
      tab === "scheduled" ||
      tab === "sent"
    ) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchEmails(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchEmails]);

  useEffect(() => {
    fetchSlackStatus();
  }, [fetchSlackStatus]);

  useEffect(() => {
    const slackStatus =
      searchParams.get("slack");

    if (slackStatus === "connected") {
      fetchSlackStatus();

      window.history.replaceState(
        {},
        "",
        "/dashboard",
      );
    }
  }, [
    searchParams,
    fetchSlackStatus,
  ]);

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

  const handleTabChange = (
    tab: "scheduled" | "sent",
  ) => {
    setActiveTab(tab);
    setSearchQuery("");
  };

  return (
    <DashboardLayout
      sidebar={
        <Sidebar
          session={session}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onCompose={() =>
            setIsComposeOpen(true)
          }
          slackConnected={slackConnected}
          slackTeamName={slackTeamName}
          slackLoading={slackLoading}
          onConnectSlack={connectSlack}
          onDisconnectSlack={
            disconnectSlack
          }
          onLogout={() =>
            signOut({
              callbackUrl: "/",
            })
          }
        />
      }
    >
      <div className="flex h-full flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#E8E8E8] bg-white px-8">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#171717]">
              {activeTab === "scheduled"
                ? "Scheduled"
                : "Sent"}
            </h1>

            <p className="mt-0.5 text-xs text-[#8A8A8A]">
              {activeTab === "scheduled"
                ? "Emails waiting to be sent"
                : "Emails that have been sent"}
            </p>
          </div>

          {/* Only functional action kept: Refresh */}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] bg-white text-[#666666] transition hover:bg-[#F7F7F7]"
            title="Refresh"
            onClick={() => {
              setSearchQuery("");
              fetchEmails();
            }}
          >
            ↻
          </button>
        </header>

        <section className="min-h-0 flex-1 overflow-auto bg-[#F7F7F8] px-8 py-6">
          <div className="mb-5">
            <div className="flex h-11 items-center rounded-lg border border-[#E5E5E5] bg-white px-4 shadow-sm">
              <span className="mr-3 w-4 text-[#999999]">
                {searching ? "…" : "⌕"}
              </span>

              <input
                type="text"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Search emails..."
                className="w-full bg-transparent text-sm text-[#333333] outline-none placeholder:text-[#A5A5A5]"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setSearchQuery("")
                  }
                  className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-[#999999] hover:bg-[#F2F2F2] hover:text-[#555555]"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E7E7E7] bg-white">
            {loading || searching ? (
              <div className="flex h-64 items-center justify-center text-sm text-[#888888]">
                {searching
                  ? "Searching emails..."
                  : "Loading emails..."}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F2F2] text-xl">
                  ✉
                </div>

                <p className="text-sm font-medium text-[#444444]">
                  {searchQuery
                    ? "No matching emails"
                    : `No ${activeTab} emails yet`}
                </p>

                <p className="mt-1 text-xs text-[#999999]">
                  {searchQuery
                    ? "Try a different search term."
                    : "Your emails will appear here."}
                </p>
              </div>
            ) : (
              <div>
                {rows.map((row) => (
                  <EmailRow
                    key={row.id}
                    email={row}
                    activeTab={activeTab}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() =>
          setIsComposeOpen(false)
        }
        onScheduled={() => {
          setSearchQuery("");
          fetchEmails();
        }}
      />
    </DashboardLayout>
  );
}

function DashboardPageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F7F7F8]">
      <div className="text-sm text-[#777777]">
        Loading dashboard...
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardContent />
    </Suspense>
  );
}