import { randomUUID } from 'crypto';
import { Email } from '@prisma/client';
import { emailQueue } from '../queues/email.queue';
import { esClient } from '../config/elasticsearch';
import { rateLimitRedis } from '../config/redis';
import { prisma } from '../lib/prisma';

interface ScheduleInput {
  userId: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delaySeconds: number;
  hourlyLimit?: number;
}

interface JobData {
  userId: string;
  senderEmail: string;
  to: string;
  subject: string;
  body: string;
}

export class EmailService {
  static async scheduleBatch(input: ScheduleInput) {
    const {
      userId,
      senderEmail,
      subject,
      body,
      recipients,
      startTime,
      delaySeconds,
      hourlyLimit,
    } = input;

    if (!recipients.length) {
      throw new Error('No recipients provided');
    }

    // A per-sender hourly-limit override, read by the worker at send time.
    // Lets the compose form's "Hourly limit" field configure behavior
    // without a redeploy; falls back to the environment default otherwise.
    if (hourlyLimit && hourlyLimit > 0) {
      await rateLimitRedis.set(
        `senderlimit:${senderEmail}`,
        hourlyLimit,
      );
    }

    const batchId = randomUUID();
    const created: Email[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const to = recipients[i];

      const scheduledAt = new Date(
        startTime.getTime() +
          i * delaySeconds * 1000,
      );

      const email = await prisma.email.create({
        data: {
          userId,
          senderEmail,
          to,
          subject,
          body,
          scheduledAt,
          status: 'SCHEDULED',
          batchId,
        },
      });

      await this.enqueue(
        email.id,
        {
          userId,
          senderEmail,
          to,
          subject,
          body,
        },
        scheduledAt,
      );

      await this.indexToSearch(email);

      created.push(email);
    }

    return {
      batchId,
      count: created.length,
      emails: created,
    };
  }

  static async enqueue(
    emailId: string,
    data: JobData,
    scheduledAt: Date,
  ) {
    const delay = Math.max(
      0,
      scheduledAt.getTime() - Date.now(),
    );

    const job = await emailQueue.add(
      'send-email',
      {
        emailId,
        ...data,
      },
      {
        jobId: emailId,
        delay,
      },
    );

    await prisma.email.update({
      where: {
        id: emailId,
      },
      data: {
        jobId: String(job.id),
      },
    });

    return job;
  }

  static async indexToSearch(email: Email) {
    try {
      await esClient.index({
        index: 'emails',
        id: email.id,
        document: {
          id: email.id,
          userId: email.userId,
          senderEmail: email.senderEmail,
          to: email.to,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt,
          sentAt: email.sentAt,
        },
      });
    } catch (err) {
      // Search indexing must never block the schedule/send path.
      console.error(
        'Elasticsearch index failed:',
        (err as Error).message,
      );
    }
  }

  static async list(
    userId: string,
    status?: string,
    page = 1,
    limit = 25,
  ) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: {
          scheduledAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.email.count({
        where,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  static async search(
    userId: string,
    q: string,
  ) {
    try {
      const result = await esClient.search({
        index: 'emails',
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: q,
                  fields: [
                    'subject',
                    'body',
                    'to',
                  ],
                },
              },
            ],
            filter: [
              {
                term: {
                  userId,
                },
              },
            ],
          },
        },
      });

      return result.hits.hits.map(
        (h: any) => h._source,
      );
    } catch (err) {
      console.error(
        'Elasticsearch search failed, falling back to Postgres:',
        (err as Error).message,
      );

      return prisma.email.findMany({
        where: {
          userId,
          OR: [
            {
              subject: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              body: {
                contains: q,
                mode: 'insensitive',
              },
            },
            {
              to: {
                contains: q,
                mode: 'insensitive',
              },
            },
          ],
        },
        take: 50,
      });
    }
  }

  /*
   * Run on boot.
   *
   * SCHEDULED rows are recovered if their BullMQ job disappeared.
   *
   * RATE_LIMITED rows are also recovered because they have not been sent
   * yet and their delayed retry job may have disappeared.
   *
   * PROCESSING rows are intentionally NOT requeued automatically because
   * the SMTP side effect may already have occurred before a crash.
   * Automatically retrying such a row could create a duplicate email.
   */
  static async reconcileOnBoot() {
    const orphaned = await prisma.email.findMany({
      where: {
        status: {
          in: [
            'SCHEDULED',
            'RATE_LIMITED',
          ],
        },
      },
    });

    let requeued = 0;

    for (const email of orphaned) {
      const existingJob = await emailQueue.getJob(
        email.jobId || email.id,
      );

      if (!existingJob) {
        await this.enqueue(
          email.id,
          {
            userId: email.userId,
            senderEmail: email.senderEmail,
            to: email.to,
            subject: email.subject,
            body: email.body,
          },
          email.scheduledAt,
        );

        requeued++;
      }
    }

    return requeued;
  }
}