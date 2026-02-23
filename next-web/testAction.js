require('dotenv').config({ path: '.env.local' });
const { getPortalProfile } = require('./src/app/actions/portal-profile-actions');

// Provide mocked headers/cookies as if we are next.js
jest = require('jest-mock');
jest.mock('next/headers', () => {
    return {
        cookies: () => ({
            get: (name) => {
                if (name === 'sb-fmhnwxtapdqzqrsjdxsm-auth-token') {
                    return { value: 'test' }; // we don't need real token, just pass the middleware
                }
            }
        })
    }
});

async function main() {
    console.log("Mocking doesn't easily work for server actions in pure node environment because of next/headers.");
}

main();
