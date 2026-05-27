import process from 'node:process';
import core from '@actions/core';

/**
 * Sends a notification payload to Slack/Teams or simulates it.
 * Triggered only when a patent disclosure passes all checks (APPROVED).
 * @param {object} report The linter report containing frontmatter and AI evaluation
 */
export async function sendReviewQueueNotification(report) {
  const webhookUrl = process.env.DISCLOSURE_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  const { title, lead_inventor, project_context } = report.frontmatter || {};
  const score = report.aiReport?.score ?? 0;
  const generalFeedback = report.aiReport?.generalFeedback ?? '';

  // Construct Slack Block Kit payload
  const slackPayload = {
    text: `⚖️ Patent Disclosure Approved: "${title}" by ${lead_inventor}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚖️ New Patent Disclosure Promoted to Review Queue',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Title:*\n${title}`
          },
          {
            type: 'mrkdwn',
            text: `*Lead Inventor:*\n${lead_inventor}`
          },
          {
            type: 'mrkdwn',
            text: `*Project:*\n${project_context}`
          },
          {
            type: 'mrkdwn',
            text: `*Quality Score:*\n*${score}/100*`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Linter Assessment:*\n${generalFeedback}`
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `File path: \`${report.file}\` | Triggered by GitHub Action`
          }
        ]
      }
    ]
  };

  if (!webhookUrl) {
    core.info("\n🔔 [NOTIFICATION SIMULATION] Webhook URL not provided. Simulated Slack notification details:");
    core.info(`   - Title: ${title}`);
    core.info(`   - Inventor: ${lead_inventor}`);
    core.info(`   - Score: ${score}/100`);
    core.info(`   - Status: PROMOTED TO COMMITTEE REVIEW QUEUE`);
    return;
  }

  core.info(`Sending notification to configured webhook: ${webhookUrl.substring(0, 30)}...`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      core.warning(`Failed to send webhook notification (${response.status}): ${errorText}`);
    } else {
      core.info("🔔 Webhook notification successfully sent to Review Queue.");
    }
  } catch (err) {
    core.warning(`Error sending webhook notification: ${err.message}`);
  }
}
