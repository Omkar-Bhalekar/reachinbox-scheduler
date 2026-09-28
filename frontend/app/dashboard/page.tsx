"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ComposeModal from "@/components/ComposeModal";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/apiClient";
import type { EmailRecord } from "@/types/api";

export default function DashboardPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"scheduled" | "sent">(
    "scheduled",
  );
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [rows, setRows] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [slackConnected, setSlackConnected] = useState(false);
  const [slackTeamName, setSlackTeamName] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);

    try {
      const status =
        activeTab === "scheduled"
          ? "SCHEDULED,PROCESSING,RATE_LIMITED"
          : "SENT";

      const res = await apiClient.get(
        `/api/emails?status=${encodeURIComponent(status)}`,
      );

      setRows(res.data.items);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchSlackStatus = useCallback(async () => {
    setSlackLoading(true);

    try {
      const res = await apiClient.get("/api/auth/whoami");

      setSlackConnected(Boolean(res.data.user.slackConnected));
      setSlackTeamName(res.data.user.slackTeamName || null);
    } catch {
      setSlackConnected(false);
      setSlackTeamName(null);
    } finally {
      setSlackLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  useEffect(() => {
    fetchSlackStatus();
  }, [fetchSlackStatus]);

  useEffect(() => {
    const slackStatus = searchParams.get("slack");

    if (slackStatus === "connected") {
      fetchSlackStatus();

      window.history.replaceState(
        {},
        "",
        "/dashboard",
      );
    }
  }, [searchParams, fetchSlackStatus]);

  const connectSlack = async () => {
    try {
      setSlackLoading(true);

      const res = await apiClient.post("/api/auth/slack/connect");

      window.location.href = res.data.authorizeUrl;
    } catch (error: any) {
      console.error("Slack connect failed:", error);

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

      await apiClient.post("/api/auth/slack/disconnect");

      setSlackConnected(false);
      setSlackTeamName(null);
    } catch (error: any) {
      console.error("Slack disconnect failed:", error);

      alert(
        error?.response?.data?.error ||
          "Unable to disconnect Slack. Please try again.",
      );
    } finally {
      setSlackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            ReachInbox Scheduler
          </h1>

          <div className="flex items-center gap-4">
            {!slackLoading &&
              (slackConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-700">
                    Slack
                    {slackTeamName
                      ? `: ${slackTeamName}`
                      : " connected"}
                  </span>

                  <Button
                    variant="secondary"
                    onClick={disconnectSlack}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  onClick={connectSlack}
                >
                  Connect Slack
                </Button>
              ))}

            {session?.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            )}

            <div className="text-sm text-right">
              <p className="font-medium text-gray-900">
                {session?.user?.name}
              </p>

              <p className="text-gray-500">
                {session?.user?.email}
              </p>
            </div>

            <Button
              variant="danger"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab("scheduled")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === "scheduled"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Scheduled Emails
            </button>

            <button
              onClick={() => setActiveTab("sent")}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === "sent"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Sent Emails
            </button>
          </div>

          <Button onClick={() => setIsComposeOpen(true)}>
            + Compose New Email
          </Button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message={`No ${activeTab} emails yet.`} />
          ) : activeTab === "scheduled" ? (
            <Table<EmailRecord>
              rows={rows}
              columns={[
                {
                  header: "Email",
                  render: (r) => r.to,
                },
                {
                  header: "Subject",
                  render: (r) => r.subject,
                },
                {
                  header: "Scheduled time",
                  render: (r) =>
                    new Date(r.scheduledAt).toLocaleString(),
                },
                {
                  header: "Status",
                  render: (r) => (
                    <StatusBadge status={r.status} />
                  ),
                },
              ]}
            />
          ) : (
            <Table<EmailRecord>
              rows={rows}
              columns={[
                {
                  header: "Email",
                  render: (r) => r.to,
                },
                {
                  header: "Subject",
                  render: (r) => r.subject,
                },
                {
                  header: "Sent time",
                  render: (r) =>
                    r.sentAt
                      ? new Date(r.sentAt).toLocaleString()
                      : "—",
                },
                {
                  header: "Status",
                  render: (r) => (
                    <StatusBadge status={r.status} />
                  ),
                },
              ]}
            />
          )}
        </div>
      </main>

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduled={fetchEmails}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SENT: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    SCHEDULED: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-yellow-100 text-yellow-700",
    RATE_LIMITED: "bg-orange-100 text-orange-700",
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        colors[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}