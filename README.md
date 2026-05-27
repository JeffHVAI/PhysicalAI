# Patent Disclosure Linter & GitHub Action

A **"Schema-First, Conversation-Driven"** patent disclosure verification tool. It scans markdown "Innovation Blueprints", validates basic metadata structure via YAML frontmatter, and performs high-fidelity AI audits on patentability vectors (such as unexpected results, competitor work-around tests, prior art context, and component modularity).

It is built as a portable CLI utility that doubles as a composite GitHub Action.

---

## 📂 Project Structure

```text
patent-disclosure-linter/
├── .github/
│   └── workflows/
│       └── disclosure-linter.yml   # Reference GitHub Workflow template
├── disclosures/
│   ├── templates/
│   │   └── blueprint-template.md   # The template inventors fill out
│   ├── example-draft.md            # Low-fidelity example (fails checks)
│   └── example-complete.md         # High-fidelity example (passes checks)
├── src/
│   ├── index.js                    # CLI and GitHub Action Orchestrator
│   ├── linter.js                   # Document parser & prompt generator
│   ├── ai-client.js                # Portable AI provider client wrapper
│   ├── github-commenter.js         # PR commenter & Job Summary builder
│   └── notifier.js                 # Review Queue webhook notifier
├── action.yml                      # Composite GitHub Action specification
├── package.json                    # Project configuration & dependencies
├── test-runner.js                  # Local validation script
└── README.md                       # This document
```

---

## ⚡ Quick Start (Local Run)

You can run the linter locally to check disclosures before committing them to git.

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Validation Tests (Mock Mode)
Without providing an LLM API key, the linter runs in mock simulation mode:
```bash
npm test
```

### 3. Run Validation Tests (Live Gemini API Mode)
To run a live test against Gemini, define your API key:
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="your-gemini-api-key"
npm test

# Linux/macOS
GEMINI_API_KEY="your-gemini-api-key" npm test
```

### 4. Run over Custom Directories
To scan a specific folder of disclosures:
```bash
node src/index.js ./my-disclosures-folder
```

---

## 🛠️ Portability Configuration

The AI caller inside `src/ai-client.js` is isolated and can be directed to other LLM models, private endpoints, or local proxies via environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `LLM_PROVIDER` | LLM client API to use (`gemini` or `openai`) | `gemini` |
| `LLM_API_KEY` | API Key for authorization | Reads `GEMINI_API_KEY` or `LLM_API_KEY` |
| `LLM_MODEL` | Specific model identifier | `gemini-1.5-flash` or `gpt-4o-mini` |
| `LLM_API_ENDPOINT` | Custom endpoint URL for private enterprise gateways | Direct Google/OpenAI REST endpoints |
| `DISCLOSURE_WEBHOOK_URL` | Webhook URL (Slack/Teams) to send approved disclosures | None (simulated in logs) |

---

## 🤖 GitHub Workflow Integration

To automate this check, copy the reference workflow `.github/workflows/disclosure-linter.yml` into your repo's workflows folder:

```yaml
name: Patent Disclosure Linter

on:
  pull_request:
    paths:
      - 'disclosures/**'

jobs:
  lint-disclosures:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write # Required to comment feedback on the PR
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Linter Action
        uses: ./patent-disclosure-linter
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          disclosures_dir: "disclosures"
          llm_provider: "gemini"
          llm_api_key: ${{ secrets.GEMINI_API_KEY }}
          disclosure_webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Key Workflow Features:
1. **Pull Request Feedback**: The action uses the PR context to comment inline, showing the exact quality score and feedback.
2. **Job Summaries**: The linter writes a summary dashboard directly into the GitHub run page.
3. **Build Blocking**: If a disclosure has structural issues or fails quality checks, the step fails (exit code 1), blocking the PR from merge until resolved.
4. **Promotion Queue**: When a disclosure successfully scores above `80`, a notification is sent to the Review Committee webhook.
