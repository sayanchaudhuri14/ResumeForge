import { parseResumeText } from '../shared/resume-parser.js';
import { buildSystemPrompt } from '../shared/system-prompt-template.js';
import { callClaude } from '../background/claude-api.js';
import { compileLatex } from '../background/latex-compiler.js';
import { SAMPLE_RESUME_TEXT, SAMPLE_JD } from './sample-data.js';
const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
const MODEL = 'claude-sonnet-4-5-20250929';
const ITERATIONS = 1;

async function runIteration(i) {
    console.log(`\n--- Iteration ${i + 1} / ${ITERATIONS} ---`);
    const startTime = Date.now();

    try {
        // 1. Parsing
        console.log('Step 1: Parsing Master Resume...');
        const parseResult = parseResumeText(SAMPLE_RESUME_TEXT);
        if (!parseResult.success) throw new Error('Parse failed: ' + parseResult.errors.join(', '));

        // 2. Build Prompt
        console.log('Step 2: Building System Prompt...');
        const systemPrompt = buildSystemPrompt(parseResult.data);

        // 3. Call Claude
        console.log(`Step 3: Calling Claude (${MODEL})...`);
        const { latex, assessment } = await callClaude({
            systemPrompt,
            userMessage: SAMPLE_JD,
            apiKey: API_KEY,
            model: MODEL
        });
        console.log(`  Fit Level: ${assessment.fit_level}`);

        // 4. Compile LaTeX
        console.log('Step 4: Compiling LaTeX...');
        const pdfDataUrl = await compileLatex(latex);
        console.log(`  PDF Data URL length: ${pdfDataUrl.length}`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Iteration ${i + 1} Success in ${duration}s`);
        return true;
    } catch (err) {
        console.error(`❌ Iteration ${i + 1} Failed`);
        console.error(err);
        return false;
    }
}

async function main() {
    console.log('Starting Integration Testing (5 Iterations)');
    let successes = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        const success = await runIteration(i);
        if (success) successes++;
        // Optional delay between calls to avoid rate limits if needed
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n====================================');
    console.log(`Final Results: ${successes} / ${ITERATIONS} Passed`);
    console.log('====================================');

    if (successes === ITERATIONS) {
        console.log('Production Readiness: Verified');
    } else {
        console.warn('Production Readiness: Issues detected');
        process.exit(1);
    }
}

main();
