export async function callClaude({ systemPrompt, userMessage, apiKey, model }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

    console.log(`[ClaudeAPI] Initiating request to model: ${model || 'claude-sonnet-4-5-20250929'}`);
    console.time('ClaudeAPI_Request');
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: model || 'claude-sonnet-4-5-20250929',
                max_tokens: 4000,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });

        console.timeEnd('ClaudeAPI_Request');

        if (!response.ok) {
            const error = await response.json();
            console.error('[ClaudeAPI] Error Response:', error);
            throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log(`[ClaudeAPI] Received response. Tokens used: ${data.usage?.output_tokens || 'unknown'}`);
        if (!data.content || data.content.length === 0) {
            throw new Error('Claude API returned empty content');
        }
        const text = data.content[0].text;

        // Parse structured response
        const latexMatch = text.match(/<LATEX>([\s\S]*?)<\/LATEX>/);
        const assessmentMatch = text.match(/<ASSESSMENT>([\s\S]*?)<\/ASSESSMENT>/);

        if (!latexMatch) throw new Error('Claude response missing <LATEX> block');
        if (!assessmentMatch) throw new Error('Claude response missing <ASSESSMENT> block');

        let assessment;
        try {
            // Find JSON block more robustly
            const jsonStr = assessmentMatch[1].trim();
            assessment = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error(`Failed to parse assessment JSON: ${e.message}`);
        }

        return {
            latex: latexMatch[1].trim(),
            assessment,
            rawResponse: text
        };
    } finally {
        clearTimeout(timeout);
    }
}
