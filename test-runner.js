import path from 'node:path';
import process from 'node:process';
import { Linter } from './src/linter.js';

async function runTests() {
  console.log("🚀 Starting Patent Disclosure Linter Test Suite...");
  
  const linter = new Linter();
  let testsFailed = false;

  // Test 1: example-draft.md (Should FAIL validation)
  const draftPath = path.resolve(process.cwd(), 'disclosures/example-draft.md');
  console.log(`\n--------------------------------------------------`);
  console.log(`🧪 Test 1: Linting example-draft.md (Expecting REJECTION)...`);
  console.log(`--------------------------------------------------`);
  
  try {
    const draftReport = await linter.check(draftPath);
    console.log(`- Success Status: ${draftReport.success}`);
    console.log(`- Metadata Valid: ${draftReport.frontmatterValid}`);
    console.log(`- Structure Valid: ${draftReport.structureValid}`);
    if (draftReport.aiReport) {
      console.log(`- Quality Score: ${draftReport.aiReport.score}/100`);
      console.log(`- Decision Status: ${draftReport.aiReport.status}`);
      console.log(`- Feedback Summary: ${draftReport.aiReport.generalFeedback}`);
    }

    if (draftReport.success === false && (!draftReport.aiReport || draftReport.aiReport.status === 'REJECTED')) {
      console.log("✅ Test 1 Passed: Draft was correctly rejected due to missing patentability markers.");
    } else {
      console.error("❌ Test 1 Failed: Draft was unexpectedly approved or checking crashed!");
      testsFailed = true;
    }
  } catch (err) {
    console.error("❌ Test 1 Error:", err);
    testsFailed = true;
  }

  // Test 2: example-complete.md (Should PASS validation)
  const completePath = path.resolve(process.cwd(), 'disclosures/example-complete.md');
  console.log(`\n--------------------------------------------------`);
  console.log(`🧪 Test 2: Linting example-complete.md (Expecting APPROVAL)...`);
  console.log(`--------------------------------------------------`);
  
  try {
    const completeReport = await linter.check(completePath);
    console.log(`- Success Status: ${completeReport.success}`);
    console.log(`- Metadata Valid: ${completeReport.frontmatterValid}`);
    console.log(`- Structure Valid: ${completeReport.structureValid}`);
    if (completeReport.aiReport) {
      console.log(`- Quality Score: ${completeReport.aiReport.score}/100`);
      console.log(`- Decision Status: ${completeReport.aiReport.status}`);
      console.log(`- Feedback Summary: ${completeReport.aiReport.generalFeedback}`);
    }

    if (completeReport.success === true && completeReport.aiReport && completeReport.aiReport.status === 'APPROVED') {
      console.log("✅ Test 2 Passed: Complete disclosure was correctly approved.");
    } else {
      console.error("❌ Test 2 Failed: Complete disclosure was unexpectedly rejected!");
      testsFailed = true;
    }
  } catch (err) {
    console.error("❌ Test 2 Error:", err);
    testsFailed = true;
  }

  console.log(`\n==================================================`);
  if (testsFailed) {
    console.error("❌ Some tests failed! Review the output above.");
    process.exit(1);
  } else {
    console.log("🎉 All tests passed successfully! Linter behavior matches expectations.");
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Fatal test runner crash:", err);
  process.exit(1);
});
