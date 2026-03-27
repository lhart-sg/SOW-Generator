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

  const SYSTEM_PROMPT = `You are an expert Salesforce implementation consultant at SETGO Partners, LLC. Analyze the scoping call transcript and return ONLY a valid JSON object — no markdown, no explanation, just raw JSON.

Return this exact structure:
{
  "sowNumber": "____",
  "effectiveDate": "[DATE]",
  "msaDate": "[MSA DATE]",
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
  "notes": "Brief AI notes on key scope decisions"
}

RULES:
- Only include Salesforce products explicitly mentioned: Sales Cloud, Service Cloud, Revenue Cloud / CPQ, Marketing Cloud / MCAE, Field Service Lightning, Sales Engagement
- Only include phases relevant to the discussion. Common phases: Discovery & Design, Configuration, Reports & Dashboards, User Acceptance Testing (UAT), Data Migration, Integration, Training, Post Go Live Support, Project Management
- If something is ambiguous or not discussed, assume OUT OF SCOPE and add to exclusions
- Estimate hours at $250/hr T&M: Discovery/Design 8-40hrs, Config 10-60hrs, Data Migration 4-16hrs, Integration 8-32hrs, Testing 4-12hrs, Training 2-8hrs, Project Mgmt 6-12hrs
- Use professional SETGO SOW language — formal, specific, client-facing
- Return ONLY the JSON object, no markdown fences`;

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
