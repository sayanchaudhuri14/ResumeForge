const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';
const MODEL = 'claude-3-haiku-latest';

async function test() {
    console.log('--- Minimal API Test ---');
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hello' }]
            })
        });

        const data = await response.json();
        if (response.ok) {
            console.log('✅ Minimal API Success');
            console.log('Response:', data.content[0].text);
        } else {
            console.error('❌ Minimal API Failed');
            console.error(JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('❌ Minimal API Error');
        console.error(err);
    }
}

test();
