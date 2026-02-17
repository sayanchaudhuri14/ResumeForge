export async function compileLatex(latexCode, compilerUrl) {
    const url = compilerUrl || 'https://latex.ytotech.com/builds/sync';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    console.log(`[LatexCompiler] Initiating compilation on ${url}`);
    console.time('LatexCompiler_Request');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                compiler: 'pdflatex',
                resources: [{ path: 'main.tex', content: latexCode }]
            })
        });

        console.timeEnd('LatexCompiler_Request');

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LaTeX compilation failed: ${errorText}`);
        }

        const pdfBlob = await response.blob();
        return await blobToDataUrl(pdfBlob);
    } finally {
        clearTimeout(timeout);
    }
}

async function blobToDataUrl(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return `data:application/pdf;base64,${base64}`;
}
