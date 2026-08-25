import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 100 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 1000 },
        { duration: '30s', target: 2000 },
        { duration: '30s', target: 0 },
    ],

    thresholds: {
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<500'],
    },
};

const BASE_URL = 'http://localhost:5000';

export default function () {

    const loginPayload = JSON.stringify({
        email: 'test12@gmail.com',
        password: '123',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        loginPayload,
        params
    );

    check(loginRes, {
        'login status 200': (r) => r.status === 200,
        'login response time < 500ms': (r) => r.timings.duration < 500,
    });
}
