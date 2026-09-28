import axios from 'axios';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';

export class SlackService {
  static getAuthorizeUrl(userId: string) {
    const params = new URLSearchParams({
      client_id: config.slack.clientId,
      scope: 'incoming-webhook,chat:write',
      redirect_uri: config.slack.redirectUri,
      state: userId,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  static async exchangeToken(code: string, userId: string) {
    const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      },
    });

    if (!response.data.ok) {
      throw new Error(response.data.error || 'Slack OAuth failed');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: response.data.access_token,
        slackWebhookUrl: response.data.incoming_webhook?.url,
        slackTeamName: response.data.team?.name,
      },
    });

    return response.data;
  }

  // Fires the moment a sender's hourly limit is hit. A user who hasn't
  // connected Slack is a silent no-op (never a crash); connecting later
  // "just works" on the very next rate-limit hit, no redeploy needed.
  static async notifyRateLimitHit(userId: string, senderEmail: string, limit: number) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.slackWebhookUrl) return;

    try {
      await axios.post(user.slackWebhookUrl, {
        text: `:warning: Hourly send limit (${limit}) reached for sender *${senderEmail}*. Remaining emails in this batch have been delayed to the next hour window.`,
      });
    } catch (err) {
      console.error('Slack notification failed:', (err as Error).message);
    }
  }
}
