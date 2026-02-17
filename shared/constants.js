// MODELS and DEFAULT_MODEL removed: User now provides explicit model ID during setup
export const LATEX_COMPILER_URL = 'https://latex.ytotech.com/builds/sync';

export const JOB_STATUS = {
    QUEUED: 'queued',
    CALLING_CLAUDE: 'calling_claude',
    COMPILING_LATEX: 'compiling_latex',
    OVERFLOW_DETECTED_TRIMMING: 'overflow_detected_trimming',
    TRIMMING_ATTEMPT_1: 'trimming_attempt_1',
    TRIMMING_ATTEMPT_2: 'trimming_attempt_2',
    DONE: 'done',
    ERROR: 'error'
};

export const MAX_JOBS_HISTORY = 20;

export const FILENAME_PREFIX = 'ResumeForge';
