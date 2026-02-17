/**
 * Parse structured resume text into a JSON object.
 * @param {string} text - The raw resume text.
 * @returns {Object} - { success: boolean, data: Object, summary: string, errors: Array }
 */
export function parseResumeText(text) {
    if (!text || typeof text !== 'string') {
        return { success: false, errors: ['Invalid input: text is required'] };
    }

    const sections = {};
    let currentSection = null;
    const lines = text.split('\n');

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Check for section header
        const headerMatch = line.match(/^===\s*(.*?)\s*===$/i);
        if (headerMatch) {
            currentSection = headerMatch[1].toUpperCase().trim();
            sections[currentSection] = sections[currentSection] || [];
            continue;
        }

        if (currentSection) {
            sections[currentSection].push(line);
        }
    }

    // Parse sections into structured data
    const data = {
        contact: parseContact(sections['CONTACT'] || []),
        experience: parseExperience(sections['EXPERIENCE'] || []),
        education: parseEducation(sections['EDUCATION'] || []),
        skills: parseSkills(sections['SKILLS'] || []),
        certifications: parseCertifications(sections['CERTIFICATIONS'] || []),
        patents: parsePatents(sections['PATENTS'] || []),
        publications: parsePublications(sections['PUBLICATIONS'] || []),
        titlesHeld: (sections['TITLES I HAVE HELD'] || []).join(', ').trim(),
        // Capture everything else for the prompt
        allSections: sections
    };

    // Validation
    const errors = [];
    if (!sections['CONTACT']) errors.push('Missing CONTACT section');
    if (!sections['EXPERIENCE']) errors.push('Missing EXPERIENCE section');
    if (!sections['EDUCATION']) errors.push('Missing EDUCATION section');
    if (!sections['SKILLS']) errors.push('Missing SKILLS section');

    const summary = `Found: ${Object.keys(sections).join(', ')}`;

    return {
        success: errors.length === 0,
        data,
        summary,
        errors
    };
}

function parseContact(lines) {
    const contact = {};
    lines.forEach(line => {
        const [key, ...values] = line.split(':');
        if (key && values.length > 0) {
            const k = key.trim().toLowerCase();
            const v = values.join(':').trim();
            contact[k] = v;
        }
    });
    return {
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        linkedin: contact.linkedin || '',
        github: contact.github || ''
    };
}

function parseExperience(lines) {
    const jobs = [];
    let currentJob = null;

    lines.forEach(line => {
        if (line.toLowerCase().startsWith('company:')) {
            if (currentJob) jobs.push(currentJob);
            currentJob = {
                bullets: []
            };

            const parts = line.split('|');
            parts.forEach(part => {
                const [key, ...values] = part.split(':');
                if (key && values.length > 0) {
                    const k = key.trim().toLowerCase();
                    const v = values.join(':').trim();
                    currentJob[k] = v;
                }
            });
        } else if (line.startsWith('-') && currentJob) {
            currentJob.bullets.push(line.substring(1).trim());
        }
    });

    if (currentJob) jobs.push(currentJob);
    return jobs;
}

function parseEducation(lines) {
    const edu = [];
    let currentEdu = null;

    lines.forEach(line => {
        if (line.toLowerCase().startsWith('institution:')) {
            if (currentEdu) edu.push(currentEdu);
            currentEdu = {};
            const parts = line.split('|');
            parts.forEach(part => {
                const [key, ...values] = part.split(':');
                if (key && values.length > 0) {
                    const k = key.trim().toLowerCase();
                    const v = values.join(':').trim();
                    currentEdu[k] = v;
                }
            });
        } else if (currentEdu) {
            const [key, ...values] = line.split(':');
            if (key && values.length > 0) {
                const k = key.trim().toLowerCase();
                const v = values.join(':').trim();
                currentEdu[k] = v;
            }
        }
    });

    if (currentEdu) edu.push(currentEdu);
    return edu;
}

function parseSkills(lines) {
    const skills = {};
    lines.forEach(line => {
        const [category, ...skillList] = line.split(':');
        if (category && skillList.length > 0) {
            const catName = category.trim();
            const list = skillList.join(':').split(',').map(s => s.trim()).filter(s => s);
            skills[catName] = list;
        }
    });
    return skills;
}

function parseCertifications(lines) {
    return lines
        .filter(line => line.startsWith('-'))
        .map(line => {
            const parts = line.substring(1).trim().split('|').map(s => s.trim());
            return {
                name: parts[0] || '',
                issuer: parts[1] || '',
                tags: parts[2] || ''
            };
        });
}

function parsePatents(lines) {
    return lines
        .filter(line => line.startsWith('-'))
        .map(line => line.substring(1).trim());
}

function parsePublications(lines) {
    return lines
        .filter(line => line.startsWith('-'))
        .map(line => line.substring(1).trim());
}

/**
 * Enhanced parsing to handle docx if mammoth is available.
 * This is a placeholder that will be completed when mammoth is integrated.
 */
export async function parseResumeDocx(fileBuffer, mammoth) {
    if (!mammoth) throw new Error('Mammoth.js not available');
    const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
    return parseResumeText(result.value);
}
