"use client";

import { useState } from "react";
import Papa from "papaparse";
import { X } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Button from "./ui/Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

export default function ComposeModal({ isOpen, onClose, onScheduled }: Props) {
  const [senderEmail, setSenderEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("5");
  const [hourlyLimit, setHourlyLimit] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleFile = (f: File | null) => {
    setFile(f);
    if (!f) return setRecipientCount(null);
    Papa.parse(f, {
      header: true,
      complete: (results) => {
        const count = (results.data as any[]).map((row) => row.email).filter(Boolean).length;
        setRecipientCount(count);
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError("Please upload a CSV file with an 'email' column");
    setError("");
    setSubmitting(true);

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const recipients = (results.data as any[]).map((row) => row.email).filter(Boolean);
        try {
          await apiClient.post("/api/emails/schedule", {
            senderEmail,
            subject,
            body,
            recipients,
            startTime: new Date(startTime).toISOString(),
            delaySeconds: parseInt(delaySeconds, 10) || 0,
            hourlyLimit: parseInt(hourlyLimit, 10) || undefined,
          });
          onScheduled?.();
          onClose();
        } catch (err: any) {
          setError(err?.response?.data?.error || "Failed to schedule emails");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Compose New Email</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Sender Email</label>
            <input
              type="email"
              required
              placeholder="you@ethereal.email"
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              required
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Body</label>
            <textarea
              required
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              CSV File (must have an &apos;email&apos; column)
            </label>
            <input
              type="file"
              accept=".csv"
              required
              className="mt-1 block w-full text-black"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            {recipientCount !== null && (
              <p className="mt-1 text-xs text-gray-500">
                Detected {recipientCount} email address{recipientCount === 1 ? "" : "es"}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Time</label>
            <input
              type="datetime-local"
              required
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Delay Between Emails (sec)</label>
              <input
                type="number"
                min="0"
                required
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Hourly Limit</label>
              <input
                type="number"
                min="1"
                required
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 text-black"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Scheduling..." : "Schedule"}
          </Button>
        </form>
      </div>
    </div>
  );
}
