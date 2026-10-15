
const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';

async function request(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`,{
    ...options,
    headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        },
    });

    let body = null;
    const text = await response.text();
    if (text) {
        try{
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    return {response, body};
}

function authHeader(token) {
    return {Authorization: `Bearer ${token}`};
}

function uniqueUser(prefix) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    return {
        name: `${prefix} Test User`,
        email: `${prefix.toLowerCase()}-${suffix}@example.com`,
        password: 'Test@12345',
    };
}

module.exports = { request, authHeader, uniqueUser, BASE_URL };