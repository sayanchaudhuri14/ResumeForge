import { parseResumeText } from '../shared/resume-parser.js';
import { buildSystemPrompt } from '../shared/system-prompt-template.js';
import { SAMPLE_RESUME_TEXT } from './sample-data.js';

function runTest() {
    console.log('--- Testing System Prompt Template ---');
    const parseResult = parseResumeText(SAMPLE_RESUME_TEXT);
    const prompt = buildSystemPrompt(parseResult.data);

    if (prompt && prompt.length > 1000) {
        console.log('✅ Prompt Generation Success');
        console.log('Prompt Length:', prompt.length);

        // Verification of key sections
        const requiredSections = [
            'MASTER RESUME DATA BANK',
            'TAILORING RULES',
            'HONESTY GUARDRAILS',
            'LATEX TEMPLATE',
            'Jordan Smith',
            'Global AI Corp',
            'MIT'
        ];

        requiredSections.forEach(section => {
            if (prompt.includes(section)) {
                console.log(`  - Found: ${section}`);
            } else {
                console.error(`  - ❌ Missing: ${section}`);
                process.exit(1);
            }
        });
    } else {
        console.error('❌ Prompt Generation Failed or too short');
        process.exit(1);
    }
}

runTest();
