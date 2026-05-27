import process from 'node:process';

/**
 * Portable AI Client wrapping generative AI APIs.
 * Supports:
 * - Gemini API (via HTTP POST)
 * - OpenAI API (via HTTP POST)
 * - Fallback Mock Mode (for local development/testing without keys)
 */
export class AiClient {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'gemini';
    this.apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
    this.model = process.env.LLM_MODEL || (this.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini');
    this.endpoint = process.env.LLM_API_ENDPOINT;

    if (!this.apiKey) {
      console.warn("[\u26A0\uFE0F WARNING] LLM_API_KEY or GEMINI_API_KEY is not defined. Running in mock simulation mode.");
    }
  }

  /**
   * Analyzes disclosure text against patent requirements.
   * @param {string} systemInstruction The system instructions instructing the LLM on how to behave.
   * @param {string} prompt The text content to analyze.
   * @param {boolean} isJson Whether to request application/json response format.
   * @returns {Promise<string>} The raw text response.
   */
  async analyze(systemInstruction, prompt, isJson = false) {
    if (!this.apiKey) {
      return this.getMockAnalysis(prompt);
    }

    if (this.provider === 'gemini') {
      return this.callGemini(systemInstruction, prompt, isJson);
    } else if (this.provider === 'openai') {
      return this.callOpenAi(systemInstruction, prompt, isJson);
    } else {
      throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  async callGemini(systemInstruction, prompt, isJson) {
    const modelName = this.model;
    const url = this.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
    
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.1
      }
    };

    if (isJson) {
      payload.generationConfig.responseMimeType = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No completion candidates returned by Gemini API.");
      }

      const text = data.candidates[0].content.parts[0].text;
      return text;
    } catch (err) {
      console.error("Gemini API call failed:", err);
      throw err;
    }
  }

  async callOpenAi(systemInstruction, prompt, isJson) {
    const url = this.endpoint || 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    };

    if (isJson) {
      payload.response_format = { type: 'json_object' };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      return text;
    } catch (err) {
      console.error("OpenAI API call failed:", err);
      throw err;
    }
  }

  getMockAnalysis(prompt) {
    // In mock mode, we inspect key phrases from our example files to simulate AI analysis
    const hasUnexpected = prompt.includes("42% reduction") || prompt.includes("unexpected");
    const hasWorkaround = prompt.includes("BOM cost") || prompt.includes("competitor");
    const hasPriorArt = prompt.includes("libflight-imu") || prompt.includes("replaced the standard");
    const hasModularity = prompt.includes("The Method") && prompt.includes("The Device");

    if (hasUnexpected && hasWorkaround && hasPriorArt && hasModularity) {
      return JSON.stringify({
        status: "APPROVED",
        score: 95,
        unexpectedResult: {
          passed: true,
          feedback: "Great quantifiable evidence (42% reduction in pitch-axis divergence under wind-shear)."
        },
        workaroundTest: {
          passed: true,
          feedback: "Excellent analysis showing competitor upgrade costs ($85 BOM increase/thermal constraints)."
        },
        priorArtContext: {
          passed: true,
          feedback: "Explicitly identifies replacing Euler-angle methods in common flight IMU library (v3.4.1)."
        },
        componentModularity: {
          passed: true,
          feedback: "Perfect component partition separating physical drone IMUs/speed controllers from the adjustment method."
        },
        generalFeedback: "Highly thorough disclosure blueprint. Exceeds validation requirements and has been queued for review."
      }, null, 2);
    } else {
      return JSON.stringify({
        status: "REJECTED",
        score: 42,
        unexpectedResult: {
          passed: false,
          feedback: "No quantifiable data found. Vague claims like 'runs faster' do not satisfy patentability standards."
        },
        workaroundTest: {
          passed: false,
          feedback: "Did not analyze how a competitor would circumvent this (e.g. custom CPU schedules)."
        },
        priorArtContext: {
          passed: false,
          feedback: "Must identify the specific standard libraries, interfaces, or standard algorithms replaced."
        },
        componentModularity: {
          passed: false,
          feedback: "Did not separate physical system components (Device) from the step-by-step algorithms (Method)."
        },
        generalFeedback: "Draft is incomplete. Key technical indicators of patentability are missing."
      }, null, 2);
    }
  }
}
