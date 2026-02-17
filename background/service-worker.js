import { JOB_STATUS, FILENAME_PREFIX } from '../shared/constants.js';
import { buildSystemPrompt } from '../shared/system-prompt-template.js';
import { callClaude } from './claude-api.js';
import { compileLatex } from './latex-compiler.js';
import { createJob, updateJob, getSettings, getJobById } from './job-manager.js';
import { compileWithOverflowRetry } from './overflow-handler.js';

// 1. On install: Create context menu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "forge-resume",
        title: "🔨 Forge Resume",
        contexts: ["selection"]
    });
});

// 2. On context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "forge-resume") {
        const jdText = info.selectionText;
        await startForgePipeline(jdText, tab.id);
    }
});

// Listen for messages from popup/settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REGENERATE_JOB') {
        startForgePipeline(message.jdText, sender.tab?.id, message.jobId, message.feedback)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async
    }
});

async function startForgePipeline(jdText, tabId, existingJobId = null, feedback = null) {
    const settings = await getSettings();

    if (!settings.apiKey || !settings.masterResume || !settings.model) {
        chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
        return;
    }

    let job;
    if (existingJobId) {
        job = await updateJob(existingJobId, {
            status: JOB_STATUS.QUEUED,
            feedback: feedback || '',
            error: null
        });
    } else {
        job = await createJob({ jdText, tabId });
    }

    try {
        await processJob(job.id);
    } catch (err) {
        console.error('[ResumeForge] startForgePipeline Error:', err);
    }

    chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'ResumeForge',
        message: 'Generating your tailored resume...'
    });
}

async function processJob(jobId) {
    const startTime = Date.now();
    console.log(`[ResumeForge] === Job ${jobId} Pipeline Start at ${new Date(startTime).toLocaleTimeString()} ===`);

    const job = await getJobById(jobId);
    try {
        const settings = await getSettings();

        if (!job) throw new Error('Job not found in storage');

        // Step 1: Call Claude
        const step1Start = Date.now();
        console.log(`[ResumeForge] Step 1: Calling Claude... (T+${(step1Start - startTime) / 1000}s)`);
        await updateJob(jobId, { status: JOB_STATUS.CALLING_CLAUDE });
        await updateStatus(job.tabId, JOB_STATUS.CALLING_CLAUDE, "⏳");

        const systemPrompt = buildSystemPrompt(settings.masterResume);
        const userMessage = job.feedback
            ? `JOB_DESCRIPTION:\n${job.jdText}\n\nUSER_FEEDBACK:\n${job.feedback}\nPlease regenerate the resume incorporating this feedback while maintaining all honesty guardrails.`
            : job.jdText;

        const { latex: initialLatex, assessment: initialAssessment } = await callClaude({
            systemPrompt,
            userMessage,
            apiKey: settings.apiKey,
            model: settings.model
        });

        const step1End = Date.now();
        console.log(`[ResumeForge] Step 1 Complete: Claude responded in ${((step1End - step1Start) / 1000).toFixed(1)}s`);

        // Step 2: Compile LaTeX (with overflow protection)
        const step2Start = Date.now();
        console.log(`[ResumeForge] Step 2: Compiling LaTeX with Overflow Protection... (T+${(step2Start - startTime) / 1000}s)`);

        const { pdfDataUrl, assessment, latex, trimAttempts } = await compileWithOverflowRetry({
            latex: initialLatex,
            assessment: initialAssessment,
            jdText: job.jdText,
            systemPrompt,
            apiKey: settings.apiKey,
            model: settings.model,
            compilerUrl: settings.compilerUrl,
            onStatusUpdate: async (status) => {
                await updateJob(jobId, { status });
                const badge = status === JOB_STATUS.OVERFLOW_DETECTED_TRIMMING ? "✂️" : "📄";
                await updateStatus(job.tabId, status, badge);
            }
        });

        const step2End = Date.now();
        console.log(`[ResumeForge] Step 2 Complete: Final PDF ready after ${trimAttempts} trims in ${((step2End - step2Start) / 1000).toFixed(1)}s`);

        // Step 3: Done
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[ResumeForge] === Job ${jobId} COMPLETED in ${totalDuration}s ===`);

        await updateJob(jobId, {
            status: JOB_STATUS.DONE,
            pdfDataUrl,
            latexCode: latex,
            assessmentJson: assessment,
            trimAttempts
        });
        await updateStatus(job.tabId, JOB_STATUS.DONE, "✓");

        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon128.png',
            title: 'Resume ready!',
            message: `Generated in ${totalDuration}s.${trimAttempts > 0 ? ` (Trimmed ${trimAttempts}x)` : ''} Click to view.`
        });

    } catch (err) {
        console.error(`[ResumeForge] Job ${jobId} Failed:`, err);
        const errorMsg = err.message || 'An unknown error occurred';

        if (jobId) {
            await updateJob(jobId, { status: JOB_STATUS.ERROR, error: errorMsg });
            if (job) await updateStatus(job.tabId, JOB_STATUS.ERROR, "✗");
        }

        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon128.png',
            title: 'Forge Failed',
            message: errorMsg.substring(0, 100)
        });
    }
}

async function updateStatus(tabId, status, badgeText) {
    const color = status === JOB_STATUS.DONE ? '#22c55e' :
        status === JOB_STATUS.ERROR ? '#ef4444' : '#2B5797';

    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color, tabId });
}
