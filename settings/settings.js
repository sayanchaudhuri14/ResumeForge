import { parseResumeText } from '../shared/resume-parser.js';
import { clearJobs, getSettings } from '../background/job-manager.js';
import { callClaude } from '../background/claude-api.js';

const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.settings-section');

const apiKeyInput = document.getElementById('set-api-key');
const masterResumeInput = document.getElementById('set-master-resume');
const modelIdInput = document.getElementById('set-model-id');
const compilerInput = document.getElementById('set-compiler');

async function init() {
    const settings = await getSettings();

    if (settings.apiKey) apiKeyInput.value = settings.apiKey;
    if (settings.masterResume) {
        const result = await chrome.storage.local.get('rawMasterResume');
        masterResumeInput.value = result.rawMasterResume || '';
    }
    if (settings.model) {
        modelIdInput.value = settings.model;
    }
    if (settings.compilerUrl) compilerInput.value = settings.compilerUrl;

    // Nav handling
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');

            const target = item.dataset.target;
            sections.forEach(sec => {
                sec.classList.add('hidden');
                if (sec.id === target) sec.classList.remove('hidden');
            });
        });
    });
}

// Save API Settings
document.getElementById('save-api-btn').addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey.startsWith('sk-ant-')) {
        showStatus('api-status', 'Invalid API key format.', 'error');
        return;
    }
    await chrome.storage.local.set({ apiKey });
    showStatus('api-status', 'API key saved successfully!', 'success');
});

// Test API Key & Model
document.getElementById('test-key-btn').addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelIdInput.value.trim();

    if (!model) {
        showStatus('api-status', 'Please enter a Model ID to test.', 'error');
        return;
    }

    showStatus('api-status', 'Testing connection...', 'info');

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
            body: JSON.stringify({
                model: model,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Ping' }]
            })
        });

        if (response.ok) {
            showStatus('api-status', 'Connection valid! ✅', 'success');
        } else {
            const err = await response.json();
            showStatus('api-status', `Error: ${err.error?.message || 'Verification failed'}`, 'error');
        }
    } catch (err) {
        showStatus('api-status', `Network error: ${err.message}`, 'error');
    }
});

// Save Master Resume
document.getElementById('save-resume-btn').addEventListener('click', async () => {
    const text = masterResumeInput.value;
    const result = parseResumeText(text);

    const preview = document.getElementById('parse-res-preview');
    preview.classList.remove('hidden');

    if (result.success) {
        await chrome.storage.local.set({
            masterResume: result.data,
            rawMasterResume: text
        });
        preview.innerHTML = `<p class="success-badge">Saved! ${result.summary}</p>`;
    } else {
        preview.innerHTML = `<p class="error-msg">Error: ${result.errors.join('<br>')}</p>`;
    }
});

// Preferences
document.getElementById('save-prefs-btn').addEventListener('click', async () => {
    const model = modelIdInput.value.trim();
    if (!model) {
        alert('Please enter a model ID');
        return;
    }
    const compilerUrl = compilerInput.value.trim();
    await chrome.storage.local.set({ model, compilerUrl });
    alert('Preferences saved!');
});

// Data Management
document.getElementById('clear-history-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all job history?')) {
        await clearJobs();
        alert('History cleared.');
    }
});

document.getElementById('reset-all-btn').addEventListener('click', async () => {
    if (confirm('This will wipe ALL settings and resumes. Are you sure?')) {
        await chrome.storage.local.clear();
        location.href = '../onboarding/onboarding.html';
    }
});

// Export/Import
document.getElementById('export-settings-btn').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resumeforge_settings.json';
    a.click();
});

document.getElementById('import-settings-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            await chrome.storage.local.set(data);
            alert('Settings imported successfully! Reloading...');
            location.reload();
        } catch (err) {
            alert('Failed to parse settings file.');
        }
    };
    reader.readAsText(file);
});

function showStatus(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.color = type === 'success' ? 'var(--success)' :
        type === 'error' ? 'var(--error)' : 'var(--primary)';

    if (type === 'success' || type === 'info') {
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

init();
