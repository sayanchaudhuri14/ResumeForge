import { MAX_JOBS_HISTORY, JOB_STATUS } from '../shared/constants.js';
import { generateId } from '../shared/utils.js';

export async function createJob({ jdText, tabId }) {
    const jobs = await getJobs();
    const newJob = {
        id: generateId(),
        status: JOB_STATUS.QUEUED,
        tabId,
        jdText,
        latexCode: null,
        assessmentJson: null,
        pdfDataUrl: null,
        feedback: '',
        error: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    jobs.unshift(newJob);
    await saveJobs(jobs.slice(0, MAX_JOBS_HISTORY));
    return newJob;
}

export async function updateJob(jobId, updates) {
    const jobs = await getJobs();
    const index = jobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
        jobs[index] = { ...jobs[index], ...updates, updatedAt: Date.now() };
        await saveJobs(jobs);
        return jobs[index];
    }
    return null;
}

export async function getJobs() {
    try {
        const result = await chrome.storage.local.get('jobs');
        return Array.isArray(result.jobs) ? result.jobs : [];
    } catch (e) {
        console.error('getJobs Error:', e);
        return [];
    }
}

export async function getJobById(jobId) {
    if (!jobId) return null;
    const jobs = await getJobs();
    return jobs.find(j => j.id === jobId) || null;
}

export async function deleteJob(jobId) {
    const jobs = await getJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    await saveJobs(filtered);
}

export async function clearJobs() {
    await chrome.storage.local.remove('jobs');
}

async function saveJobs(jobs) {
    await chrome.storage.local.set({ jobs });
}

export async function getSettings() {
    const result = await chrome.storage.local.get(['apiKey', 'masterResume', 'model', 'compilerUrl']);
    return result;
}
