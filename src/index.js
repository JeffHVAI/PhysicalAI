import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import core from '@actions/core';
import { Linter } from './linter.js';
import { postGithubFeedback } from './github-commenter.js';
import { sendReviewQueueNotification } from './notifier.js';

// Helper to find markdown files, skipping 'templates' and 'README.md'
function findMarkdownFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file.toLowerCase() !== 'templates' && file.toLowerCase() !== 'node_modules' && file.toLowerCase() !== '.git') {
        results = results.concat(findMarkdownFiles(filePath));
      }
    } else if (file.endsWith('.md') && file.toLowerCase() !== 'readme.md') {
      results.push(filePath);
    }
  }
  return results;
}

async function run() {
  const isGithubAction = process.env.GITHUB_ACTIONS === 'true';
  
  // Read inputs from action or default to local './disclosures'
  let disclosuresDir = '';
  if (isGithubAction) {
    disclosuresDir = core.getInput('disclosures_dir') || './disclosures';
  } else {
    disclosuresDir = process.argv[2] || './disclosures';
  }

  // Resolve absolute path
  const absoluteDisclosuresDir = path.resolve(process.cwd(), disclosuresDir);
  core.info(`📂 Scanning for patent disclosures in: ${absoluteDisclosuresDir}`);

  if (!fs.existsSync(absoluteDisclosuresDir)) {
    const errMsg = `Directory not found: ${absoluteDisclosuresDir}`;
    if (isGithubAction) {
      core.setFailed(errMsg);
    } else {
      console.error(`❌ ${errMsg}`);
      process.exit(1);
    }
    return;
  }

  const markdownFiles = findMarkdownFiles(absoluteDisclosuresDir);
  core.info(`🔍 Found ${markdownFiles.length} disclosure file(s) to evaluate.`);

  if (markdownFiles.length === 0) {
    core.info("ℹ️ No disclosure files found to lint.");
    process.exit(0);
  }

  const linter = new Linter();
  let overallFailed = false;

  for (const file of markdownFiles) {
    const relativePath = path.relative(process.cwd(), file);
    core.info(`\n--- Linting: ${relativePath} ---`);
    
    const report = await linter.check(file);

    if (report.success) {
      core.info(`✅ PASS: ${report.file} (Score: ${report.aiReport.score}/100)`);
      if (report.aiReport.generalFeedback) {
        core.info(`   Feedback: ${report.aiReport.generalFeedback}`);
      }
      
      // Notify Review Queue when disclosure passes
      await sendReviewQueueNotification(report);
    } else {
      core.error(`❌ FAIL: ${report.file}`);
      overallFailed = true;

      if (!report.frontmatterValid || !report.structureValid) {
        core.error("   Structural/Frontmatter issues:");
        for (const err of report.errors) {
          core.error(`     - ${err}`);
        }
      } else if (report.aiReport) {
        core.info(`   Quality Score: ${report.aiReport.score}/100`);
        const ai = report.aiReport;
        
        // Print detailed failing vectors
        const printVector = (name, obj) => {
          const mark = obj.passed ? '✅' : '❌';
          if (!obj.passed) {
            core.error(`   ${mark} ${name}: ${obj.feedback}`);
          } else {
            core.info(`   ${mark} ${name}`);
          }
        };

        printVector('Unexpected Results', ai.unexpectedResult);
        printVector('Work-Around Test', ai.workaroundTest);
        printVector('Prior Art Context', ai.priorArtContext);
        printVector('Component Modularity', ai.componentModularity);
        core.info(`   General Feedback: ${ai.generalFeedback}`);
      }
    }

    // Post comments back to GitHub PR / Summary if applicable
    if (isGithubAction) {
      await postGithubFeedback(report);
    }
  }

  core.info("\n----------------------------------------");
  if (overallFailed) {
    const failureMsg = "One or more patent disclosures failed the quality check.";
    if (isGithubAction) {
      core.setFailed(failureMsg);
    } else {
      console.error(`❌ ${failureMsg}`);
      process.exit(1);
    }
  } else {
    core.info("🎉 All patent disclosures passed checks successfully!");
    process.exit(0);
  }
}

run().catch((err) => {
  if (process.env.GITHUB_ACTIONS === 'true') {
    core.setFailed(`Unhandled exception: ${err.message}`);
  } else {
    console.error("❌ Unhandled exception:", err);
    process.exit(1);
  }
});
