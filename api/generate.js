export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  const { transcript } = req.body;
  if (!transcript || transcript.trim().length < 50) {
    return res.status(400).json({ error: "Transcript too short or missing" });
  }

  const SYSTEM_PROMPT = `You are an expert Salesforce implementation consultant at SETGO Partners, LLC. Analyze the scoping call transcript and return ONLY a valid JSON object. No markdown, no explanation, no code fences — raw JSON only.

JSON structure:
{
  "sowNumber": "1XXX",
  "effectiveDate": "Month DD, YYYY",
  "msaDate": "Month DD, YYYY",
  "clientName": "Full Client Name",
  "sowType": "Design & Implementation",
  "products": ["Sales Cloud"],
  "services": [
    {
      "phase": "Phase Name",
      "description": "Paragraph describing what will be done",
      "bullets": ["bullet 1", "bullet 2"],
      "hours": 16
    }
  ],
  "exclusions": ["exclusion 1", "exclusion 2"],
  "additionalAssumptions": ["assumption specific to this engagement"],
  "notes": "Brief notes on key scope decisions made"
}

SOW HEADER RULES:
- sowNumber: generate a realistic SETGO SOW number between 1100 and 1200 (e.g. 1142, 1157, 1163). Never use "____" or "1XXX".
- effectiveDate: extract the date from the transcript if mentioned. If not mentioned, use today's date: March 26, 2026. Format as "Month DD, YYYY" (e.g. "March 26, 2026").
- msaDate: extract the MSA/contract date from transcript if mentioned. If not mentioned, use the same as effectiveDate.
- clientName: extract the full company name from the transcript.

HOUR ESTIMATION RULES - FOLLOW EXACTLY:

DISCOVERY & DESIGN:
- Start with 4 hours per Salesforce product in scope
- Add 2 hours per integration discussed
- Add 2 hours if data migration is in scope
- Add 4 hours if multiple business units or highly complex processes discussed
- Round to nearest even number. Min 8, Max 40.

CONFIGURATION:
- Sales Cloud: 16 hours base
- Service Cloud: add 16 hours
- Sales Engagement: add 8 hours
- Revenue Cloud / CPQ: add 24 hours
- Marketing Cloud / MCAE: add 20 hours
- Field Service Lightning: add 24 hours
- Add 4 hours if complex automation or flows discussed
- Add 4 hours per custom object beyond standard (Lead, Contact, Account, Opportunity)
- Min 10, Max 80.

REPORTS & DASHBOARDS:
- Always include. Default 4 hours. Use 8 hours only if advanced reporting explicitly discussed.

USER ACCEPTANCE TESTING (UAT):
- Always include. Hours = round up (configuration hours divided by 8). Min 4, Max 16.

DATA MIGRATION:
- Only include if explicitly discussed in transcript
- Accounts and Contacts only: 8 hours. Add 4 hours per additional object. Min 4, Max 24.

INTEGRATIONS - one phase per integration:
- Simple out-of-box connector: 4 hours
- Middleware (Workato, MuleSoft, Zapier): 8 hours
- Custom REST API: 12 hours
- Complex bi-directional: 16 hours

TRAINING:
- Always include. Base 4 hours. Add 2 hours per additional product beyond first. Max 12.

DEPLOYMENT PREP & GO LIVE:
- ONLY include if client has existing Salesforce org needing sandbox to production deploy
- New implementations: DO NOT include. Hours: 4.

POST GO LIVE SUPPORT:
- Always include: 4 hours

PROJECT MANAGEMENT:
- Always include. Hours = 15% of all other hours combined, rounded to nearest 2. Min 6, Max 20.
- If total hours > 80: bullet = "Provide weekly status reporting, including updates on timeline, budget, and key action items"
- If total hours <= 80: bullet = "Provide status updates for the project regarding timeline, effort and to-dos"

SCOPE RULES:
- Only include products explicitly mentioned in transcript
- If ambiguous or not discussed: OUT OF SCOPE, add to exclusions

REQUIRED PHASE DESCRIPTION OPENINGS:
- Discovery & Design: "Conduct working discovery and design sessions with the Client which will include:"
- Configuration: "Based on the understanding of the current business processes, Salesforce will be configured to manage, enhance, and automate the business processes. The following configurations will be made based on the design:"
- UAT: "User Acceptance Testing (UAT) is used to validate that the system meets the scope of the project. For this project, Standard UAT will be completed. A block of X hours will be allotted to perform the following UAT tasks:"
- Data Migration: "This is a block of X hours to perform the following data migration tasks:"
- Post Go Live Support: "This is a bucket of X hours to provide support after the Project has gone live. Post-Go Live Support hours expire after two-weeks, or when exhausted. Client will not be billed for unused support hours."
- Training: "Provide high-level end user and admin training"
- Project Management: "Project Management hours support alignment, coordination, and successful delivery of the project, including:"

Return ONLY raw JSON. No markdown. No explanation.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: "Analyze this scoping call transcript and generate the SOW JSON:\n\n" + transcript,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || "Anthropic API error" });
    }

    const data = await response.json();
    const raw = data.content?.find((b) => b.type === "text")?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();

    let sow;
    try {
      sow = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response as JSON. Try again." });
    }

    return res.status(200).json({ sow });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
