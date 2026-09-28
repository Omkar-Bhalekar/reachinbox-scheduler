export type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED" | "RATE_LIMITED";

export interface EmailRecord {
  id: string;
  userId: string;
  senderEmail: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  batchId: string | null;
  error: string | null;
}

export interface ListEmailsResponse {
  items: EmailRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface WhoAmIResponse {
  user: { id: string; email: string; name: string };
}
