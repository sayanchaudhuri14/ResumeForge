import { JOB_STATUS, FILENAME_PREFIX } from '../shared/constants.js';
import { formatDate, truncateText } from '../shared/utils.js';
import { getJobs, getJobById } from '../background/job-manager.js';

const setupState = document.getElementById('setup-state');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const resultsView = document.getElementById('results-view');

const historySelect = document.getElementById('history-select');
const pdfFrame = document.getElementById('pdf-frame');
const fitBadge = document.getElementById('fit-badge');

let currentJobId = null;

async function init() {
    const settings = await chrome.storage.local.get(['setupComplete']);
    if (!settings.setupComplete) {
        showState('setup');
        return;
    }

    const jobs = await getJobs();
    if (jobs.length === 0) {
        showState('empty');
        return;
    }

    renderHistory(jobs);

    // Show most recent job by default
    const mostRecentJob = jobs[0];
    currentJobId = mostRecentJob.id;
    renderJob(mostRecentJob);

    // If job is still processing, poll for updates
    const processingStatuses = [
        JOB_STATUS.QUEUED,
        JOB_STATUS.CALLING_CLAUDE,
        JOB_STATUS.COMPILING_LATEX,
        JOB_STATUS.OVERFLOW_DETECTED_TRIMMING,
        JOB_STATUS.TRIMMING_ATTEMPT_1,
        JOB_STATUS.TRIMMING_ATTEMPT_2
    ];
    if (processingStatuses.includes(mostRecentJob.status)) {
        pollJob(mostRecentJob.id);
    }
}

function showState(state) {
    [setupState, emptyState, loadingState, errorState, resultsView].forEach(el => el.classList.add('hidden'));

    switch (state) {
        case 'setup': setupState.classList.remove('hidden'); break;
        case 'empty': emptyState.classList.remove('hidden'); break;
        case 'loading': loadingState.classList.remove('hidden'); break;
        case 'error': errorState.classList.remove('hidden'); break;
        case 'results': resultsView.classList.remove('hidden'); break;
    }
}

function renderHistory(jobs) {
    historySelect.innerHTML = '<option value="">Recent Forges</option>';
    jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        const title = job.jdText ? truncateText(job.jdText, 30) : 'Job ' + job.id.substr(0, 4);
        option.textContent = `${title} (${formatDate(job.createdAt)})`;
        historySelect.appendChild(option);
    });
}

async function renderJob(job) {
    currentJobId = job.id;

    if (job.status === JOB_STATUS.DONE) {
        showState('results');
        document.getElementById('res-job-title').textContent = extractJobTitle(job.jdText);
        document.getElementById('res-timestamp').textContent = `Generated ${formatDate(job.createdAt)}`;

        // PDF
        pdfFrame.src = job.pdfDataUrl;

        // Trim Info
        const trimNote = document.getElementById('res-trim-note');
        if (job.trimAttempts > 0) {
            trimNote.textContent = `✂️ Trimmed ${job.trimAttempts}x to fit 1 page`;
            trimNote.classList.remove('hidden');
        } else {
            trimNote.classList.add('hidden');
        }

        // Warning Banner
        const warningBanner = document.getElementById('res-warning-banner');
        const assessment = job.assessmentJson;
        if (assessment._warning) {
            document.getElementById('res-warning-text').textContent = assessment._warning;
            warningBanner.classList.remove('hidden');
        } else {
            warningBanner.classList.add('hidden');
        }

        // Assessment
        const ass = job.assessmentJson;
        fitBadge.textContent = ass.fit_level + ' FIT';
        fitBadge.className = `fit-badge fit-${ass.fit_level.toLowerCase()}`;

        document.getElementById('res-recommendation').textContent = ass.recommendation;

        renderSkills(ass.required_skills, 'required-skills-body');
        renderSkills(ass.preferred_skills, 'preferred-skills-body');

        renderList(ass.gaps, 'res-gaps');
        renderList(ass.strengths, 'res-strengths');
        renderList(ass.interview_risks, 'res-risks');

        document.getElementById('debug-latex').textContent = job.latexCode;
    } else if (job.status === JOB_STATUS.ERROR) {
        showState('error');
        document.getElementById('error-message').textContent = job.error || 'Unknown error';
    } else {
        showState('loading');
        updateLoadingText(job.status);
    }
}

function updateLoadingText(status) {
    const text = {
        [JOB_STATUS.QUEUED]: 'In Queue...',
        [JOB_STATUS.CALLING_CLAUDE]: 'Claude is tailoring...',
        [JOB_STATUS.COMPILING_LATEX]: 'Compiling PDF...',
        [JOB_STATUS.OVERFLOW_DETECTED_TRIMMING]: 'Resume too long — trimming...',
        [JOB_STATUS.TRIMMING_ATTEMPT_1]: 'Recompiling (attempt 1)...',
        [JOB_STATUS.TRIMMING_ATTEMPT_2]: 'Recompiling (attempt 2)...'
    };
    document.getElementById('loading-text').textContent = text[status] || 'Processing...';
}

function renderSkills(skills, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    skills.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${s.skill}</td>
      <td><span class="skill-status-icon status-${s.status}">${s.status === 'matched' ? '✓' : s.status === 'coursework' ? '🎓' : '✗'}</span></td>
      <td><small>${s.backing || '-'}</small></td>
    `;
        tbody.appendChild(tr);
    });
}

function renderList(items, ulId) {
    const ul = document.getElementById(ulId);
    ul.innerHTML = items.map(item => `<li>${item}</li>`).join('');
}

function extractJobTitle(jdText) {
    const lines = jdText.split('\n');
    return lines[0].substring(0, 50); // Simple heuristic
}

async function pollJob(jobId) {
    console.log(`[ResumeForge] Starting poll for job: ${jobId}`);
    const interval = setInterval(async () => {
        const job = await getJobById(jobId);
        console.log(`[ResumeForge] Polling result for ${jobId}:`, job?.status);

        if (!job || jobId !== currentJobId) {
            clearInterval(interval);
            return;
        }

        if (job.status === JOB_STATUS.DONE || job.status === JOB_STATUS.ERROR) {
            clearInterval(interval);
            renderJob(job);
        } else {
            updateLoadingText(job.status);
        }
    }, 2000);
}

// Event Listeners
historySelect.addEventListener('change', async (e) => {
    if (e.target.value) {
        const job = await getJobById(e.target.value);
        renderJob(job);
    }
});

document.getElementById('download-btn').addEventListener('click', async () => {
    const job = await getJobById(currentJobId);
    if (job && job.pdfDataUrl) {
        const settings = await chrome.storage.local.get(['masterResume']);
        const userName = settings.masterResume?.contact?.name || 'Resume';
        const sanitizedName = userName.replace(/\s+/g, '_');
        const role = extractJobTitle(job.jdText).replace(/\s+/g, '_');

        const link = document.createElement('a');
        link.href = job.pdfDataUrl;
        link.download = `${sanitizedName}_${role}.pdf`;
        link.click();
    }
});

document.getElementById('regenerate-btn').addEventListener('click', async () => {
    const feedback = document.getElementById('feedback-text').value;
    const job = await getJobById(currentJobId);

    showState('loading');
    chrome.runtime.sendMessage({
        type: 'REGENERATE_JOB',
        jobId: currentJobId,
        jdText: job.jdText,
        feedback
    }, (response) => {
        if (response.success) {
            pollJob(currentJobId);
        } else {
            showState('error');
            document.getElementById('error-message').textContent = response.error;
        }
    });
});

document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
});

document.getElementById('open-onboarding').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
});

document.getElementById('retry-btn').addEventListener('click', () => {
    location.reload();
});

init();
