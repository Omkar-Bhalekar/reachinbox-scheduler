import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';
import { rateLimitRedis } from '../config/redis';

const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const OAUTH_STATE_PREFIX = 'slack-oauth-state:';

export class SlackService {
  static async createOAuthState(userId: string) {
    const state = crypto.randomBytes(32).toString('hex');

    await rateLimitRedis.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      userId,
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );

    return state;
  }

  static async consumeOAuthState(state: string) {
    const key = `${OAUTH_STATE_PREFIX}${state}`;

    const userId = await rateLimitRedis.get(key);

    if (!userId) {
      return null;
    }

    // Consume the state immediately so it cannot be reused.
    await rateLimitRedis.del(key);

    return userId;
  }

  static getAuthorizeUrl(state: string) {
    const params = new URLSearchParams({
      client_id: config.slack.clientId,
      scope: 'incoming-webhook,chat:write',
      redirect_uri: config.slack.redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  static async exchangeToken(code: string, userId: string) {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      null,
      {
        params: {
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
          redirect_uri: config.slack.redirectUri,
        },
      },
    );

    if (!response.data.ok) {
      throw new Error(response.data.error || 'Slack OAuth failed');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: response.data.access_token,
        slackWebhookUrl: response.data.incoming_webhook?.url ?? null,
        slackTeamName: response.data.team?.name ?? null,
      },
    });

    return response.data;
  }

  static async disconnect(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        slackAccessToken: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.slackAccessToken) {
      try {
        const response = await axios.post(
          'https://slack.com/api/auth.revoke',
          null,
          {
            params: {
              token: user.slackAccessToken,
            },
          },
        );

        if (!response.data.ok) {
          console.warn(
            'Slack token revoke returned an error:',
            response.data.error,
          );
        }
      } catch (error) {
        // We still clear our local credentials even if Slack's revoke
        // request fails. This prevents the application from continuing
        // to use the stored credentials.
        console.warn(
          'Slack token revoke request failed:',
          (error as Error).message,
        );
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: null,
        slackWebhookUrl: null,
        slackTeamName: null,
      },
    });
  }

  static async notifyRateLimitHit(
    userId: string,
    senderEmail: string,
    limit: number,
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.slackWebhookUrl) return;

    try {
      await axios.post(user.slackWebhookUrl, {
        text: `:warning: Hourly send limit (${limit}) reached for sender *${senderEmail}*. Remaining emails in this batch have been delayed to the next hour window.`,
      });
    } catch (err) {
      console.error(
        'Slack notification failed:',
        (err as Error).message,
      );
    }
  }
}