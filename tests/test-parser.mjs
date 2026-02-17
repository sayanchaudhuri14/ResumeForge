import { parseResumeText } from '../shared/resume-parser.js';
import { SAMPLE_RESUME_TEXT } from './sample-data.js';

function runTest() {
    console.log('--- Testing Resume Parser ---');
    const result = parseResumeText(SAMPLE_RESUME_TEXT);

    if (result.success) {
        console.log('✅ Parser Success');
        console.log('Summary:', result.summary);
        console.log('Parsed Data:', JSON.stringify(result.data, null, 2).substring(0, 500) + '...');

        // Specific checks
        const data = result.data;
        if (data.contact.name !== 'Jordan Smith') console.error('❌ Name mismatch');
        if (data.experience.length !== 2) console.error('❌ Experience count mismatch');
        if (data.education.length !== 1) console.error('❌ Education count mismatch');
        if (data.titlesHeld.split(',').length < 2) console.error('❌ Titles Held mismatch');
    } else {
        console.error('❌ Parser Failed');
        console.error('Errors:', result.errors);
        process.exit(1);
    }
}

runTest();
