// background/overflow-handler.js
// Detects if compiled PDF exceeds 1 page and triggers a trim-and-recompile cycle.

/**
 * Checks PDF page count from the compiled blob.
 * Uses a lightweight heuristic: count /Type /Page occurrences in the PDF binary.
 * This avoids needing a full PDF parser library.
 */
export function getPdfPageCount(pdfArrayBuffer) {
    const bytes = new Uint8Array(pdfArrayBuffer);
    const text = new TextDecoder('latin1').decode(bytes);

    // Heuristic 1: Count "/Type /Page" objects (permisssive regex)
    // We use \b to ensure we don't match "/Type /Pages"
    // We also handle potential lack of spaces like "/Type/Page"
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    const countByPages = pageMatches ? pageMatches.length : 0;

    // Heuristic 2: Find the root "/Pages" object explicitly
    // Format: /Type /Pages /Count 1 ...
    const rootCountMatch = text.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
    const countByRoot = rootCountMatch ? parseInt(rootCountMatch[1], 10) : 0;

    // Heuristic 3: Scan for ALL "/Count n" patterns and take the maximum
    // In simple LaTeX-generated PDFs, the largest /Count value is usually the total page count.
    const allCountMatches = [...text.matchAll(/\/Count\s+(\d+)/g)];
    const maxCountInDoc = allCountMatches.reduce((max, m) => Math.max(max, parseInt(m[1], 10)), 0);

    console.log(`[ResumeForge] Page count heuristics: Objects=${countByPages}, RootCount=${countByRoot}, MaxCountInDoc=${maxCountInDoc}`);

    // Return the maximum of all three heuristics
    const finalCount = Math.max(countByPages, countByRoot, maxCountInDoc);

    // Fallback: If all fail but the PDF is clearly a PDF, assume at least 1
    if (finalCount === 0 && text.startsWith('%PDF-')) {
        console.warn('[ResumeForge] All heuristics returned 0 on a valid PDF. Falling back to 1.');
        return 1;
    }

    return finalCount;
}

/**
 * Builds a trim request message for Claude when the resume overflows.
 * Sends back the original LaTeX + instruction to shorten specific parts.
 */
export function buildTrimMessage(originalLatex, pageCount, originalJd) {
    return `The resume you generated compiled to ${pageCount} pages instead of 1. You MUST trim it to fit exactly 1 page.

Here is the LaTeX you generated:

<ORIGINAL_LATEX>
${originalLatex}
</ORIGINAL_LATEX>

Apply these fixes in order until it fits 1 page:
1. Shorten any bullet over 180 characters — cut subordinate clauses, remove tool names already in skills
2. Reduce summary to 2 sentences maximum
3. Cut the least relevant certification
4. Remove coursework lines from education
5. Shorten skill category lines — remove skills least relevant to the JD
6. If still too long, reduce to 4 bullets per job instead of 5

Return the SAME two-block format: <LATEX>...</LATEX> and <ASSESSMENT>...</ASSESSMENT>.
The assessment should be identical to your previous one — only the LaTeX changes.

Original JD for reference:
${originalJd}`;
}

/**
 * Full pipeline with overflow retry.
 * Call this instead of directly calling compile.
 * 
 * @param {object} params
 * @param {string} params.latex - LaTeX source from Claude
 * @param {object} params.assessment - Parsed assessment JSON
 * @param {string} params.jdText - Original JD text
 * @param {string} params.systemPrompt - System prompt
 * @param {string} params.apiKey - Anthropic API key
 * @param {string} params.model - Model ID
 * @param {string} params.compilerUrl - LaTeX compiler URL
 * @param {function} params.onStatusUpdate - Callback for status updates
 * @returns {Promise<{pdfDataUrl: string, assessment: object, latex: string, trimAttempts: number}>}
 */
export async function compileWithOverflowRetry({
    latex,
    assessment,
    jdText,
    systemPrompt,
    apiKey,
    model,
    compilerUrl,
    onStatusUpdate
}) {
    const MAX_TRIM_ATTEMPTS = 2;
    let currentLatex = latex;
    let currentAssessment = assessment;
    let trimAttempts = 0;

    for (let attempt = 0; attempt <= MAX_TRIM_ATTEMPTS; attempt++) {
        // Compile LaTeX to PDF
        if (onStatusUpdate) onStatusUpdate(
            attempt === 0 ? 'compiling_latex' : `trimming_attempt_${attempt}`
        );

        const pdfResponse = await fetch(compilerUrl || 'https://latex.ytotech.com/builds/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                compiler: 'pdflatex',
                resources: [{ main: true, content: currentLatex }]
            })
        });

        if (!pdfResponse.ok) {
            const errorText = await pdfResponse.text();
            throw new Error(`LaTeX compilation failed: ${errorText}`);
        }

        const pdfBlob = await pdfResponse.blob();
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        const pageCount = getPdfPageCount(pdfArrayBuffer);

        console.log(`[ResumeForge] Attempt ${attempt}: PDF has ${pageCount} page(s)`);

        // If 1 page, we're done
        if (pageCount <= 1) {
            const pdfDataUrl = await blobToDataUrl(new Blob([pdfArrayBuffer], { type: 'application/pdf' }));
            return {
                pdfDataUrl,
                assessment: currentAssessment,
                latex: currentLatex,
                trimAttempts
            };
        }

        // If >1 page and we haven't exhausted retries, ask Claude to trim
        if (attempt < MAX_TRIM_ATTEMPTS) {
            trimAttempts++;
            if (onStatusUpdate) onStatusUpdate(`overflow_detected_trimming`);

            console.log(`[ResumeForge] Overflow detected (${pageCount} pages). Requesting trim #${trimAttempts}...`);

            const trimMessage = buildTrimMessage(currentLatex, pageCount, jdText);

            const trimResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: model || 'claude-sonnet-4-5-20250929',
                    max_tokens: 8000,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: `JOB_DESCRIPTION:\n${jdText}` },
                        { role: 'assistant', content: `<LATEX>\n${currentLatex}\n</LATEX>\n\n<ASSESSMENT>\n${JSON.stringify(currentAssessment)}\n</ASSESSMENT>` },
                        { role: 'user', content: trimMessage }
                    ]
                })
            });

            if (!trimResponse.ok) {
                const error = await trimResponse.json();
                throw new Error(`Claude trim request failed: ${error.error?.message || trimResponse.statusText}`);
            }

            const trimData = await trimResponse.json();
            const trimText = trimData.content[0].text;

            const latexMatch = trimText.match(/<LATEX>([\s\S]*?)<\/LATEX>/);
            const assessmentMatch = trimText.match(/<ASSESSMENT>([\s\S]*?)<\/ASSESSMENT>/);

            if (latexMatch) {
                currentLatex = latexMatch[1].trim();
            } else {
                console.warn('[ResumeForge] Trim response missing <LATEX> block, using previous version');
            }

            if (assessmentMatch) {
                try {
                    currentAssessment = JSON.parse(assessmentMatch[1].trim());
                } catch (e) {
                    console.warn('[ResumeForge] Failed to parse trimmed assessment, keeping previous');
                }
            }
        }
    }

    // If we've exhausted retries and still >1 page, return what we have with a warning
    console.warn(`[ResumeForge] Still >1 page after ${MAX_TRIM_ATTEMPTS} trim attempts. Returning best effort.`);

    const pdfResponse = await fetch(compilerUrl || 'https://latex.ytotech.com/builds/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            compiler: 'pdflatex',
            resources: [{ main: true, content: currentLatex }]
        })
    });

    const finalBlob = await pdfResponse.blob();
    const pdfDataUrl = await blobToDataUrl(finalBlob);

    return {
        pdfDataUrl,
        assessment: {
            ...currentAssessment,
            _warning: `Resume is still >1 page after ${MAX_TRIM_ATTEMPTS} trim attempts. Manual editing may be needed.`
        },
        latex: currentLatex,
        trimAttempts
    };
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
