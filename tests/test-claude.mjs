import { callClaude } from '../background/claude-api.js';
import { parseResumeText } from '../shared/resume-parser.js';
import { buildSystemPrompt } from '../shared/system-prompt-template.js';
import { SAMPLE_RESUME_TEXT, SAMPLE_JD } from './sample-data.js';

const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
const MODEL = 'claude-3-5-sonnet-latest';

async function runTest() {
    console.log('--- Testing Claude API ---');
    const parseResult = parseResumeText(SAMPLE_RESUME_TEXT);
    const systemPrompt = buildSystemPrompt(parseResult.data);

    try {
        console.log('Calling Claude API (this may take a moment)...');
        const result = await callClaude({
            systemPrompt,
            userMessage: SAMPLE_JD,
            apiKey: API_KEY,
            model: MODEL
        });

        console.log('✅ API Call Success');
        console.log('Assessment Fit Level:', result.assessment.fit_level);
        console.log('LaTeX Code Length:', result.latex.length);

        if (!result.latex.includes('\\documentclass')) {
            console.error('❌ LaTeX result looks invalid');
            process.exit(1);
        }

    } catch (err) {
        console.error('❌ API Call Failed');
        console.error('Error Name:', err.name);
        console.error('Error Message:', err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    }
}

runTest();
