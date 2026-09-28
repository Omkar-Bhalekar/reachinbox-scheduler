"use client";

import type { Session } from "next-auth";
import Button from "@/components/ui/Button";

type SidebarProps = {
  session: Session | null;
  activeTab: "scheduled" | "sent";
  onTabChange: (tab: "scheduled" | "sent") => void;
  onCompose: () => void;
  slackConnected: boolean;
  slackTeamName: string | null;
  slackLoading: boolean;
  onConnectSlack: () => void;
  onDisconnectSlack: () => void;
  onLogout: () => void;
};

export default function Sidebar({
  session,
  activeTab,
  onTabChange,
  onCompose,
  slackConnected,
  slackTeamName,
  slackLoading,
  onConnectSlack,
  onDisconnectSlack,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-[250px] shrink-0 flex-col border-r border-[#E8E8E8] bg-white">
      {/* Logo */}
      <div className="flex h-[72px] items-center px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5C5CEB] text-sm font-bold text-white">
            O
          </div>

          <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#171717]">
            outbox
          </span>
        </div>
      </div>

      {/* User */}
      <div className="px-4">
        <div className="rounded-xl border border-[#ECECEC] bg-[#FAFAFA] p-3">
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8E8FF] text-sm font-semibold text-[#5C5CEB]">
                {session?.user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#171717]">
                {session?.user?.name || "User"}
              </p>

              <p className="truncate text-xs text-[#8A8A8A]">
                {session?.user?.email || ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Compose */}
      <div className="px-4 pt-5">
        <button
          onClick={onCompose}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5C5CEB] text-sm font-semibold text-white transition hover:bg-[#4D4DDA]"
        >
          <span className="text-lg leading-none">+</span>
          Compose
        </button>
      </div>

      {/* Navigation */}
      <div className="mt-7 px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A0A0A0]">
          Core
        </p>

        <button
          onClick={() => onTabChange("scheduled")}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
            activeTab === "scheduled"
              ? "bg-[#F0F0FF] font-semibold text-[#5C5CEB]"
              : "font-medium text-[#555555] hover:bg-[#F7F7F7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="text-base">◷</span>
            Scheduled
          </span>

          {activeTab === "scheduled" && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#5C5CEB]" />
          )}
        </button>

        <button
          onClick={() => onTabChange("sent")}
          className={`mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
            activeTab === "sent"
              ? "bg-[#F0F0FF] font-semibold text-[#5C5CEB]"
              : "font-medium text-[#555555] hover:bg-[#F7F7F7]"
          }`}
        >
          <span className="flex items-center gap-3">
            <span className="text-base">✈</span>
            Sent
          </span>

          {activeTab === "sent" && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#5C5CEB]" />
          )}
        </button>
      </div>

      {/* Bottom section */}
      <div className="mt-auto border-t border-[#EEEEEE] p-4">
        {!slackLoading && (
          <div className="mb-3 rounded-lg bg-[#F8F8F8] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#333333]">
                  Slack
                </p>

                <p className="mt-0.5 text-[11px] text-[#8A8A8A]">
                  {slackConnected
                    ? slackTeamName || "Connected"
                    : "Not connected"}
                </p>
              </div>

              <span
                className={`h-2 w-2 rounded-full ${
                  slackConnected ? "bg-[#36B37E]" : "bg-[#C4C4C4]"
                }`}
              />
            </div>

            <button
              onClick={
                slackConnected
                  ? onDisconnectSlack
                  : onConnectSlack
              }
              className="mt-2 text-xs font-medium text-[#5C5CEB] hover:underline"
            >
              {slackConnected ? "Disconnect" : "Connect Slack"}
            </button>
          </div>
        )}

        <Button
          variant="danger"
          onClick={onLogout}
                 >
          Logout
        </Button>
      </div>
    </aside>
  );
}