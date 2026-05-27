import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { AiClient } from './ai-client.js';

const SYSTEM_INSTRUCTION = `
You are an expert Patent Attorney and IP Linter. Your job is to analyze "Innovation Blueprint" disclosures and check if they meet the standards required for high-fidelity patent applications.

You must respond ONLY with a JSON object. Do not wrap the JSON in markdown code blocks like \`\`\`json. The JSON object must have this exact structure:
{
  "status": "APPROVED" | "REJECTED",
  "score": number (0-100),
  "unexpectedResult": {
    "passed": boolean,
    "feedback": "detailed review of the unexpected results citing specific parts or describing what is missing"
  },
  "workaroundTest": {
    "passed": boolean,
    "feedback": "detailed review of competitor work-arounds citing details or describing what is missing"
  },
  "priorArtContext": {
    "passed": boolean,
    "feedback": "detailed review of standard libraries or prior methods replaced, or what is missing"
  },
  "componentModularity": {
    "passed": boolean,
    "feedback": "detailed review of the separation of Method and Device, or what is missing"
  },
  "generalFeedback": "overall summary of what is good and exactly what needs to be improved"
}

To approve (status: "APPROVED", score >= 80), the disclosure MUST satisfy all four key areas:
1. **The Unexpected Result**: Contains quantifiable data/metrics (e.g. "42% reduction", "30% speedup vs 5% expected") demonstrating a surprising technical effect. Simple claims like "it runs faster" or "more efficient" must fail.
2. **The Work-Around Test**: Explicitly addresses how a competitor would try to build an alternative to avoid the patent, and details why it is difficult, expensive, or technically unfeasible.
3. **Prior Art Context**: Mentions the specific standard libraries, libraries version, algorithms, or standard methods that were replaced or modified.
4. **Component Modularity**: Separates the Method (algorithmic steps) from the Device (hardware system components like processors, sensors, actuators).
`;

export class Linter {
  constructor() {
    this.aiClient = new AiClient();
  }

  /**
   * Parse the disclosure file and perform frontmatter and structural checks.
   * @param {string} filePath Absolute path to markdown file
   * @returns {object} Initial parsing results
   */
  parseFile(filePath) {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    
    // Parse YAML frontmatter
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = rawContent.match(frontmatterRegex);
    
    if (!match) {
      return {
        success: false,
        errors: ["Invalid format: Missing YAML frontmatter or delimiters (---) at the top of the file."]
      };
    }

    const yamlStr = match[1];
    const bodyStr = match[2];
    let frontmatter = {};
    const errors = [];

    try {
      frontmatter = yaml.load(yamlStr) || {};
    } catch (e) {
      return {
        success: false,
        errors: [`YAML frontmatter parsing failed: ${e.message}`]
      };
    }

    // Validate frontmatter keys
    const requiredMetadata = ['title', 'lead_inventor', 'project_context', 'status'];
    for (const key of requiredMetadata) {
      if (!frontmatter[key] || String(frontmatter[key]).trim() === '' || String(frontmatter[key]).startsWith('[') && String(frontmatter[key]).endsWith(']')) {
        errors.push(`Missing or placeholder metadata value: '${key}'`);
      }
    }

    // Validate markdown headers (case insensitive search for sections)
    const bodyLower = bodyStr.toLowerCase();
    const requiredSections = [
      { name: '1. The Bottleneck (Problem)', search: 'bottleneck' },
      { name: '2. The Breakthrough (Solution)', search: 'breakthrough' },
      { name: '3. The Evidence (Data/Implementation)', search: 'evidence' },
      { name: '4. Why It’s Unique (Non-Obviousness)', search: 'unique' }
    ];

    for (const sec of requiredSections) {
      if (!bodyLower.includes(sec.search)) {
        errors.push(`Missing section: '${sec.name}'`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      frontmatter,
      body: bodyStr,
      rawContent
    };
  }

  /**
   * Run full check including AI validation
   * @param {string} filePath Absolute path to markdown file
   * @returns {Promise<object>} Linter result report
   */
  async check(filePath) {
    const parseResult = this.parseFile(filePath);
    
    if (!parseResult.success) {
      return {
        file: path.basename(filePath),
        filePath,
        success: false,
        frontmatterValid: false,
        structureValid: false,
        errors: parseResult.errors,
        aiReport: null
      };
    }

    const { frontmatter, body } = parseResult;
    
    try {
      const userPrompt = `
      Please evaluate the following patent disclosure document:
      
      TITLE: ${frontmatter.title}
      LEAD INVENTOR: ${frontmatter.lead_inventor}
      PROJECT CONTEXT: ${frontmatter.project_context}
      STATUS: ${frontmatter.status}
      
      CONTENT:
      ${body}
      `;

      const aiResponseRaw = await this.aiClient.analyze(SYSTEM_INSTRUCTION, userPrompt, true);
      
      // Clean up markdown block wraps if the LLM returned it anyway
      let cleanJson = aiResponseRaw.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```$/, '').trim();
      }

      const aiReport = JSON.parse(cleanJson);
      
      const overallSuccess = aiReport.status === 'APPROVED';

      return {
        file: path.basename(filePath),
        filePath,
        success: overallSuccess,
        frontmatterValid: true,
        structureValid: true,
        errors: [],
        aiReport
      };
    } catch (e) {
      console.error(`AI analysis failed for ${filePath}:`, e);
      return {
        file: path.basename(filePath),
        filePath,
        success: false,
        frontmatterValid: true,
        structureValid: true,
        errors: [`AI review analysis failed: ${e.message}`],
        aiReport: null
      };
    }
  }
}
