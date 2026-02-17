import { parseResumeText } from '../shared/resume-parser.js';
import { debounce } from '../shared/utils.js';

const steps = document.querySelectorAll('.step-content');
const dots = document.querySelectorAll('.step-dot');
const apiKeyInput = document.getElementById('api-key');
const masterResumeInput = document.getElementById('master-resume');
const parsePreview = document.getElementById('parse-preview');
const parseStats = document.getElementById('parse-stats');
const parseErrors = document.getElementById('parse-errors');

const modelIdInput = document.getElementById('model-id');
const testBtn = document.getElementById('test-connection-btn');
const testStatus = document.getElementById('test-status');

let currentStep = 1;
let isVerified = false;

// Navigation
function showStep(step) {
    steps.forEach(s => s.classList.remove('active'));
    dots.forEach(d => {
        d.classList.remove('active', 'completed');
        const dStep = parseInt(d.dataset.step);
        if (dStep === step) d.classList.add('active');
        if (dStep < step) d.classList.add('completed');
    });
    document.getElementById(`step-${step}`).classList.add('active');
    currentStep = step;
}

testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelIdInput.value.trim();

    if (!apiKey.startsWith('sk-ant-')) {
        showTestStatus('Invalid API key format.', 'error');
        return;
    }
    if (!model) {
        showTestStatus('Please enter a Model ID.', 'error');
        return;
    }

    showTestStatus('Testing connection...', 'info');
    testBtn.disabled = true;

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
            showTestStatus('Connection successful! ✅', 'success');
            isVerified = true;
            document.getElementById('next-1').disabled = false;
            document.getElementById('next-1').title = '';
        } else {
            const err = await response.json();
            showTestStatus(`Error: ${err.error?.message || 'Verification failed'}`, 'error');
            isVerified = false;
            document.getElementById('next-1').disabled = true;
        }
    } catch (err) {
        showTestStatus(`Network error: ${err.message}`, 'error');
        isVerified = false;
        document.getElementById('next-1').disabled = true;
    } finally {
        testBtn.disabled = false;
    }
});

function showTestStatus(msg, type) {
    testStatus.textContent = msg;
    testStatus.classList.remove('hidden');
    testStatus.style.color = type === 'success' ? 'var(--success)' :
        type === 'error' ? 'var(--error)' : 'var(--primary)';
}

document.getElementById('next-1').addEventListener('click', () => {
    if (isVerified) {
        showStep(2);
    }
});

document.getElementById('prev-2').addEventListener('click', () => showStep(1));
document.getElementById('next-2').addEventListener('click', () => {
    const result = parseResumeText(masterResumeInput.value);
    if (result.success) {
        showStep(3);
    } else {
        updatePreview(result);
    }
});

document.getElementById('prev-3').addEventListener('click', () => showStep(2));

document.getElementById('finish-btn').addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelIdInput.value.trim();
    const resumeText = masterResumeInput.value;
    const parseResult = parseResumeText(resumeText);

    if (parseResult.success) {
        await chrome.storage.local.set({
            apiKey,
            model,
            masterResume: parseResult.data,
            rawMasterResume: resumeText,
            setupComplete: true
        });
        window.close();
    }
});

// Live Parsing Preview
const updatePreview = (result) => {
    parsePreview.classList.remove('hidden');
    if (result.success) {
        document.getElementById('parse-status').textContent = 'Valid';
        document.getElementById('parse-status').className = 'success-badge';
        parseErrors.classList.add('hidden');

        const data = result.data;
        parseStats.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${data.experience.length}</span>
        <span class="stat-label">Jobs</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${data.education.length}</span>
        <span class="stat-label">Education</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${Object.keys(data.skills).length}</span>
        <span class="stat-label">Skill Cats</span>
      </div>
    `;
    } else {
        document.getElementById('parse-status').textContent = 'Invalid';
        document.getElementById('parse-status').className = 'error-msg';
        parseStats.innerHTML = '';
        parseErrors.classList.remove('hidden');
        parseErrors.innerHTML = result.errors.map(e => `• ${e}`).join('<br>');
    }
};

masterResumeInput.addEventListener('input', debounce(() => {
    const result = parseResumeText(masterResumeInput.value);
    updatePreview(result);
}, 500));

// Example Data
const SAMPLE_RESUME = `=== CONTACT ===
Name: Alex Rivera
Email: alex.rivera@example.com
Phone: +1-555-0123
LinkedIn: linkedin.com/in/arivera
GitHub: github.com/arivera

=== EXPERIENCE ===
Company: TechFlow Solutions | Title: Senior ML Engineer | Location: Remote | Start: Jan 2021 | End: Present
- Led development of RAG-based search pipeline, improving accuracy from 72% to 89% for 1M+ documents.
- Shipped end-to-end computer vision model for defect detection, reducing false positives by 40%.
- Optimized distributed training loops, reducing latency from 450ms to 120ms per inference.
- Mentored junior engineers and drove best practices for model versioning and monitoring.
- Scaled inference API to handle 5k requests per second using Kubernetes and TensorFlow Serving.

Company: DataSphere Analytics | Title: Data Scientist | Location: San Francisco, CA | Start: June 2018 | End: Dec 2020
- Built churn prediction model using XGBoost, increasing customer retention by 15% in Q3.
- Automated ETL pipelines using Airflow, saving 20 engineering hours per week.
- Designed A/B tests for recommendation engine, resulting in 8% lift in CTR.
- Presented data insights to executive leadership, influencing product roadmap for 2020.
- Implemented anomaly detection system for fraud prevention, reducing losses by $50k/month.

=== EDUCATION ===
Institution: Stanford University | Degree: Master of Science | Field: Computer Science | CGPA: 3.9/4.0 | Start: Sept 2016 | End: June 2018
Thesis: Efficient Neural Architecture Search for Mobile Devices
Coursework: Deep Learning, Natural Language Processing, Distributed Systems

=== SKILLS ===
Languages: Python, C++, SQL, Go
ML Frameworks: PyTorch, TensorFlow, Scikit-learn, HuggingFace
Data Engineering: Spark, Kafka, Airflow, Snowflake
Cloud & DevOps: AWS, Google Cloud, Docker, Kubernetes
Generative AI: LLMs, LangChain, Vector Databases (Pinecone, Weaviate)

=== CERTIFICATIONS ===
- AWS Certified Machine Learning Specialty | Amazon Web Services | cloud, ml
- Deep Learning Specialization | Coursera | dl, nlp

=== TITLES I HAVE HELD ===
Senior ML Engineer, Data Scientist, Machine Learning Engineer
`;

document.getElementById('show-example').addEventListener('click', () => {
    masterResumeInput.value = SAMPLE_RESUME;
    const result = parseResumeText(SAMPLE_RESUME);
    updatePreview(result);
});

document.getElementById('show-format').addEventListener('click', () => {
    alert('Please refer to the README or the example for the required format sections:\n\n=== CONTACT ===\n=== EXPERIENCE ===\n=== EDUCATION ===\n=== SKILLS ===\n=== CERTIFICATIONS ===\n=== TITLES I HAVE HELD ===');
});
