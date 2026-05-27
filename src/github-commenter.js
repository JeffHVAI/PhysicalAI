import fs from 'node:fs';
import process from 'node:process';
import github from '@actions/github';
import core from '@actions/core';

/**
 * Constructs a beautiful markdown report for GitHub PR comments and Job summaries.
 * @param {object} report The linter report object
 * @returns {string} Markdown text
 */
export function buildMarkdownComment(report) {
  const statusEmoji = report.success ? '🟢' : '🔴';
  const statusWord = report.success ? 'APPROVED' : 'REJECTED';
  const header = `### ${statusEmoji} **Patent Disclosure Review: ${statusWord}** (Score: **${report.aiReport?.score ?? 0}/100**)\n`;
  
  let md = header;
  
  if (!report.frontmatterValid || !report.structureValid) {
    md += `\n> [!CAUTION]\n> **Structural Errors Found**: The file failed basic parsing checks. Please fix the following errors:\n`;
    for (const err of report.errors) {
      md += `> - ${err}\n`;
    }
    return md;
  }

  const ai = report.aiReport;
  
  // Status Grid
  md += `\n| Patentability Vector | Status | Criteria Summary |\n`;
  md += `| :--- | :---: | :--- |\n`;
  md += `| **Unexpected Results** | ${ai.unexpectedResult.passed ? '✅ Passed' : '❌ Failed'} | Quantifiable performance boosts or surprising technical discoveries. |\n`;
  md += `| **Work-Around Test** | ${ai.workaroundTest.passed ? '✅ Passed' : '❌ Failed'} | Competitor clone complexity and alternative design costs. |\n`;
  md += `| **Prior Art Context** | ${ai.priorArtContext.passed ? '✅ Passed' : '❌ Failed'} | Specific standard libraries or prior-art algorithms replaced. |\n`;
  md += `| **Component Modularity** | ${ai.componentModularity.passed ? '✅ Passed' : '❌ Failed'} | Explicit partition between the System/Device and the algorithmic Method. |\n`;
  md += `\n`;

  // Details per Vector
  md += `#### 🔍 Detailed Vector Feedback\n`;
  
  // Helper to add vector feedback block
  const addVectorBlock = (title, vector) => {
    const alertType = vector.passed ? 'NOTE' : 'WARNING';
    const indicator = vector.passed ? '✅' : '❌';
    md += `> [!${alertType}]\n`;
    md += `> **${indicator} ${title}**\n`;
    md += `> ${vector.feedback.split('\n').join('\n> ')}\n\n`;
  };

  addVectorBlock('Unexpected Results', ai.unexpectedResult);
  addVectorBlock('Work-Around Test', ai.workaroundTest);
  addVectorBlock('Prior Art Context', ai.priorArtContext);
  addVectorBlock('Component Modularity', ai.componentModularity);

  md += `#### 💬 General Recommendations\n`;
  md += `${ai.generalFeedback}\n`;

  if (!report.success) {
    md += `\n---\n*📝 **Action Required**: Please edit your disclosure markdown file in the \`/disclosures\` folder to address the failing vectors and push your changes. The linter will automatically run again.*`;
  } else {
    md += `\n---\n*🎉 **Next Steps**: This disclosure has passed screening and is now promoted to the **Patent Review Committee Queue**.*`;
  }

  return md;
}

/**
 * Posts feedback directly as a comment on the PR.
 * Writes to Job Summary if running in GitHub Actions.
 */
export async function postGithubFeedback(report) {
  const markdownReport = buildMarkdownComment(report);

  // Write to GitHub Job Summary (if available)
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, markdownReport + '\n');
      core.info("Wrote disclosure linter report to GitHub Step Summary.");
    } catch (e) {
      core.error(`Failed to write to GITHUB_STEP_SUMMARY: ${e.message}`);
    }
  }

  // Attempt to comment on the Pull Request
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.info("GITHUB_TOKEN not found, skipping Pull Request comment.");
    return;
  }

  try {
    const context = github.context;
    
    // Check if event is pull request
    if (context.eventName !== 'pull_request') {
      core.info(`Event type '${context.eventName}' is not a pull request. Skipping PR commenting.`);
      return;
    }

    const prNumber = context.payload.pull_request.number;
    const { owner, repo } = context.issue;
    const octokit = github.getOctokit(token);

    core.info(`Posting patent feedback comment to PR #${prNumber} in ${owner}/${repo}...`);
    
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: markdownReport
    });
    
    core.info("Successfully posted feedback comment to GitHub PR.");
  } catch (err) {
    core.error(`Could not post comment to GitHub PR: ${err.message}`);
  }
}
