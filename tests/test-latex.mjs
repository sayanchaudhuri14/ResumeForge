import { compileLatex } from '../background/latex-compiler.js';

const SAMPLE_LATEX = `\\documentclass{article}
\\begin{document}
Hello ResumeForge Testing
\\end{document}`;

async function runTest() {
    console.log('--- Testing LaTeX Compiler ---');
    try {
        console.log('Calling LaTeX Compiler...');
        const dataUrl = await compileLatex(SAMPLE_LATEX);

        if (dataUrl && dataUrl.startsWith('data:application/pdf;base64,')) {
            console.log('✅ LaTeX Compiler Success');
            console.log('Data URL length:', dataUrl.length);
        } else {
            console.error('❌ LaTeX Compiler failed to return valid data URL');
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ LaTeX Compiler Failed');
        console.error(err);
        process.exit(1);
    }
}

runTest();
