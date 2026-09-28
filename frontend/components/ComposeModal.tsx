"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  X,
  Upload,
  Clock3,
  ChevronDown,
  FileText,
  Users,
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";

import { apiClient } from "@/lib/apiClient";
import Button from "./ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export default function ComposeModal({
  isOpen,
  onClose,
  onScheduled,
}: Props) {
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [recipientCount, setRecipientCount] =
    useState<number | null>(null);

  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("5");
  const [hourlyLimit, setHourlyLimit] = useState("100");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [showSchedule, setShowSchedule] = useState(true);

  if (!isOpen) return null;

  const handleFile = (f: File | null) => {
    setFile(f);

    if (!f) {
      setRecipientCount(null);
      return;
    }

    setError("");

    Papa.parse(f, {
      header: true,
      complete: (results) => {
        const count = (results.data as any[])
          .map((row) => row.email)
          .filter(Boolean).length;

        setRecipientCount(count);
      },
      error: () => {
        setRecipientCount(null);
        setError("Unable to read the CSV file");
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError(
        "Please upload a CSV file with an 'email' column",
      );
      return;
    }

    if (!startTime) {
      setError("Please select a start time");
      return;
    }

    setError("");
    setSubmitting(true);

    Papa.parse(file, {
      header: true,

      complete: async (results) => {
        const recipients = (results.data as any[])
          .map((row) => row.email)
          .filter(Boolean);

        if (recipients.length === 0) {
          setError(
            "No valid email addresses were found in the CSV file",
          );
          setSubmitting(false);
          return;
        }

        try {
          await apiClient.post(
            "/api/emails/schedule",
            {
              senderEmail,
              subject,
              body,
              recipients,
              startTime: new Date(
                startTime,
              ).toISOString(),
              delaySeconds:
                parseInt(delaySeconds, 10) || 0,
              hourlyLimit:
                parseInt(hourlyLimit, 10) || undefined,
            },
          );

          onScheduled?.();
          onClose();
        } catch (err: any) {
          setError(
            err?.response?.data?.error ||
              "Failed to schedule emails",
          );
        } finally {
          setSubmitting(false);
        }
      },

      error: () => {
        setError("Unable to read the CSV file");
        setSubmitting(false);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171717]/45 p-4 backdrop-blur-[3px]">
      <div className="flex max-h-[94vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-[#E3E3E3] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">

        {/* Header */}
        <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-[#ECECEC] bg-white px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEEEFF] text-[#5C5CEB]">
              <Mail size={18} />
            </div>

            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#171717]">
                Compose new email
              </h2>

              <p className="mt-0.5 text-xs text-[#8A8A8A]">
                Create and schedule your email campaign
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close compose"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#777777] transition hover:bg-[#F4F4F4] hover:text-[#222222] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 overflow-y-auto bg-white"
        >
          <div className="px-7 py-6">

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#F4C7C3] bg-[#FFF5F4] px-4 py-3">
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0 text-[#D92D20]"
                />

                <div>
                  <p className="text-xs font-semibold text-[#B42318]">
                    Unable to schedule email
                  </p>

                  <p className="mt-0.5 text-xs leading-5 text-[#D92D20]">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* From */}
            <div className="flex items-center border-b border-[#EEEEEE] py-3.5">
              <label className="w-[72px] shrink-0 text-sm font-medium text-[#777777]">
                From
              </label>

              <input
                type="email"
                required
                placeholder="you@ethereal.email"
                value={senderEmail}
                onChange={(e) =>
                  setSenderEmail(e.target.value)
                }
                className="min-w-0 flex-1 bg-transparent text-sm text-[#222222] outline-none placeholder:text-[#B5B5B5]"
              />
            </div>

            {/* To */}
            <div className="border-b border-[#EEEEEE] py-5">
              <div className="flex items-start">
                <label className="w-[72px] shrink-0 pt-3 text-sm font-medium text-[#777777]">
                  To
                </label>

                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="recipient-csv"
                    className={`group flex min-h-[76px] cursor-pointer items-center gap-4 rounded-xl border border-dashed px-4 transition ${
                      file
                        ? "border-[#A7E3C5] bg-[#F2FCF6]"
                        : "border-[#D7D7D7] bg-[#FAFAFA] hover:border-[#8E8EF3] hover:bg-[#F9F9FF]"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        file
                          ? "bg-[#DDF7E8] text-[#16834B]"
                          : "bg-[#EEEEFF] text-[#5C5CEB]"
                      }`}
                    >
                      {file ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Upload size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#333333]">
                        {file
                          ? file.name
                          : "Upload recipient list"}
                      </p>

                      <p className="mt-1 text-xs text-[#999999]">
                        CSV file with an{" "}
                        <span className="font-medium text-[#777777]">
                          email
                        </span>{" "}
                        column
                      </p>
                    </div>

                    <span className="rounded-lg border border-[#DDDDDD] bg-white px-3 py-1.5 text-xs font-medium text-[#555555] shadow-sm">
                      Browse
                    </span>

                    <input
                      id="recipient-csv"
                      type="file"
                      accept=".csv"
                      required
                      className="hidden"
                      onChange={(e) =>
                        handleFile(
                          e.target.files?.[0] || null,
                        )
                      }
                    />
                  </label>

                  {recipientCount !== null && (
                    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-[#F2FCF6] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Users
                          size={14}
                          className="text-[#16834B]"
                        />

                        <span className="text-xs font-medium text-[#267A4A]">
                          {recipientCount} recipient
                          {recipientCount === 1
                            ? ""
                            : "s"}{" "}
                          detected
                        </span>
                      </div>

                      <span className="text-[11px] font-medium text-[#5D9B76]">
                        Ready
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-[#EEEEEE] py-4">
              <label className="w-[72px] shrink-0 text-sm font-medium text-[#777777]">
                Subject
              </label>

              <input
                type="text"
                required
                placeholder="Enter email subject"
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#222222] outline-none placeholder:font-normal placeholder:text-[#B5B5B5]"
              />
            </div>

            {/* Message */}
            <div className="mt-6 overflow-hidden rounded-xl border border-[#E1E1E1] bg-white shadow-sm">
              <textarea
                required
                rows={10}
                placeholder="Write your email..."
                value={body}
                onChange={(e) =>
                  setBody(e.target.value)
                }
                className="block min-h-[230px] w-full resize-none bg-white px-5 py-5 text-sm leading-6 text-[#333333] outline-none placeholder:text-[#B0B0B0]"
              />

              <div className="flex h-10 items-center justify-end border-t border-[#EEEEEE] px-4">
                <span className="text-[11px] text-[#AAAAAA]">
                  {body.length} characters
                </span>
              </div>
            </div>

            {/* Delivery settings */}
            <div className="mt-6 overflow-hidden rounded-xl border border-[#E2E2E2] bg-[#FAFAFA]">
              <button
                type="button"
                onClick={() =>
                  setShowSchedule(
                    (value) => !value,
                  )
                }
                className="flex w-full items-center justify-between px-4 py-4 transition hover:bg-[#F7F7F7]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEEEFF] text-[#5C5CEB]">
                    <Clock3 size={17} />
                  </div>

                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#333333]">
                      Delivery settings
                    </p>

                    <p className="mt-0.5 text-xs text-[#999999]">
                      Schedule, delay and hourly
                      sending limit
                    </p>
                  </div>
                </div>

                <ChevronDown
                  size={18}
                  className={`text-[#888888] transition-transform ${
                    showSchedule
                      ? "rotate-180"
                      : ""
                  }`}
                />
              </button>

              {showSchedule && (
                <div className="border-t border-[#E5E5E5] px-4 pb-5 pt-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                    {/* Start time */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#555555]">
                        Start time
                      </label>

                      <input
                        type="datetime-local"
                        required
                        value={startTime}
                        onChange={(e) =>
                          setStartTime(
                            e.target.value,
                          )
                        }
                        className="h-10 w-full rounded-lg border border-[#DADADA] bg-white px-3 text-xs text-[#333333] outline-none transition focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
                      />
                    </div>

                    {/* Delay */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#555555]">
                        Delay between emails
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          required
                          value={delaySeconds}
                          onChange={(e) =>
                            setDelaySeconds(
                              e.target.value,
                            )
                          }
                          className="h-10 w-full rounded-lg border border-[#DADADA] bg-white px-3 pr-14 text-sm text-[#333333] outline-none transition focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
                        />

                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#999999]">
                          sec
                        </span>
                      </div>
                    </div>

                    {/* Hourly limit */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#555555]">
                        Hourly limit
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          required
                          value={hourlyLimit}
                          onChange={(e) =>
                            setHourlyLimit(
                              e.target.value,
                            )
                          }
                          className="h-10 w-full rounded-lg border border-[#DADADA] bg-white px-3 pr-16 text-sm text-[#333333] outline-none transition focus:border-[#5C5CEB] focus:ring-2 focus:ring-[#5C5CEB]/10"
                        />

                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#999999]">
                          / hour
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#E6E6FF] bg-[#F6F6FF] px-3 py-3 text-xs text-[#666666]">
                    <Clock3
                      size={14}
                      className="mt-0.5 shrink-0 text-[#5C5CEB]"
                    />

                    <span className="leading-5">
                      Emails are distributed using
                      the selected delay and hourly
                      limit. If the hourly limit is
                      reached, remaining emails
                      continue automatically in the
                      next available hour.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-[#E9E9E9] bg-white px-7 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F1F1F1] text-[#777777]">
                <FileText size={14} />
              </div>

              <div>
                <p className="text-[11px] font-medium text-[#999999]">
                  Recipients
                </p>

                <p className="text-xs font-semibold text-[#444444]">
                  {recipientCount !== null
                    ? `${recipientCount} recipient${
                        recipientCount === 1
                          ? ""
                          : "s"
                      }`
                    : "No recipients selected"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-10 rounded-lg border border-[#DCDCDC] bg-white px-4 text-sm font-medium text-[#555555] transition hover:bg-[#F7F7F7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <Button
                type="submit"
                disabled={submitting}
                className="flex h-10 items-center gap-2 rounded-lg bg-[#5C5CEB] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4D4DDA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Schedule email
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}