"use client";

import { useRouter } from "next/navigation";
import type { EmailRecord } from "@/types/api";

type EmailRowProps = {
  email: EmailRecord;
  activeTab: "scheduled" | "sent";
};

export default function EmailRow({
  email,
  activeTab,
}: EmailRowProps) {
  const router = useRouter();

  const initial = email.to.charAt(0).toUpperCase();

  const displayTime =
    activeTab === "sent"
      ? email.sentAt
        ? new Date(email.sentAt).toLocaleString()
        : "—"
      : new Date(email.scheduledAt).toLocaleString();

  const openEmail = () => {
    router.push(`/email/${email.id}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openEmail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEmail();
        }
      }}
      className="group flex min-h-[78px] cursor-pointer items-center gap-4 border-b border-[#EEEEEE] px-5 py-3.5 transition hover:bg-[#FAFAFA] last:border-b-0"
    >
      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAEAFF] text-sm font-semibold text-[#5C5CEB]">
        {initial}
      </div>

      {/* Recipient */}
      <div className="w-[230px] shrink-0">
        <p className="truncate text-sm font-semibold text-[#222222]">
          {email.to}
        </p>

        <p className="mt-0.5 text-xs text-[#999999]">
          {activeTab === "sent" ? "Sent" : "Scheduled"}
        </p>
      </div>

      {/* Subject + preview */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium text-[#333333]">
            {email.subject}
          </p>

          <span className="shrink-0 text-xs text-[#B0B0B0]">
            —
          </span>

          <p className="truncate text-sm text-[#999999]">
            {email.body}
          </p>
        </div>
      </div>

      {/* Time / status */}
      <div className="flex w-[180px] shrink-0 items-center justify-end gap-3">
        <div className="text-right">
          <p className="text-xs font-medium text-[#555555]">
            {displayTime}
          </p>

          <StatusBadge status={email.status} />
        </div>

        {/* Star */}
        <button
          type="button"
          className="relative z-10 text-xl leading-none text-[#C2C2C2] transition hover:text-[#666666]"
          title="Star email"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          ☆
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SENT: "bg-[#ECFDF3] text-[#16834B]",
    SCHEDULED: "bg-[#F0F0FF] text-[#5C5CEB]",
    PROCESSING: "bg-[#FFF7E6] text-[#B7791F]",
    RATE_LIMITED: "bg-[#FFF4E5] text-[#C76A00]",
    FAILED: "bg-[#FEF2F2] text-[#C53030]",
  };

  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
        styles[status] || "bg-[#F3F3F3] text-[#666666]"
      }`}
    >
      {status}
    </span>
  );
}