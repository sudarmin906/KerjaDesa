'use strict';

const assert = require('node:assert/strict');

process.env.NODE_ENV = 'production';
process.env.KERJADESA_DB_DISABLED = '1';

const store = require('../database/store');
const auth = require('../middleware/auth');

async function main() {
  const user = await store.create('users', {
    nama_lengkap: 'KerjaDesa Auth Test',
    username: 'auth-test-' + Date.now(),
    password_hash: 'not-used-in-session-test',
    role: 'ADMIN',
    status: 'ACTIVE'
  });

  try {
    const normalToken = await auth.issueSession(user, false);
    assert.match(normalToken, /^[A-Za-z0-9_-]{64}$/);

    const normalResponse = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; }
    };
    auth.setAuthResponseCookies(
      normalResponse,
      normalToken,
      { headers: { origin: 'https://kerjadesa-pro.blitz.cloud', host: 'kerjadesa-pro.blitz.cloud', 'x-forwarded-proto': 'https' } },
      false
    );
    assert.equal(normalResponse.headers['Set-Cookie'].length, 2);
    assert.match(normalResponse.headers['Set-Cookie'][0], /HttpOnly/);
    assert.match(normalResponse.headers['Set-Cookie'][0], /Secure/);
    assert.match(normalResponse.headers['Set-Cookie'][0], /SameSite=Lax/);
    assert.doesNotMatch(normalResponse.headers['Set-Cookie'][0], /Max-Age=/);

    const request = {
      headers: {
        cookie: '__Host-kd_session=' + encodeURIComponent(normalToken)
      }
    };
    const authenticated = await auth.authenticate(request);
    assert.equal(authenticated.user.id, user.id);
    assert.equal(authenticated.rememberMe, false);

    await auth.revokeSession(normalToken);
    assert.equal(await auth.authenticate(request), null);

    const rememberToken = await auth.issueSession(user, true);
    const rememberResponse = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; }
    };
    auth.setAuthResponseCookies(
      rememberResponse,
      rememberToken,
      { headers: { origin: 'https://kerjadesa-pro.blitz.cloud', host: 'kerjadesa-pro.blitz.cloud', 'x-forwarded-proto': 'https' } },
      true
    );
    assert.match(rememberResponse.headers['Set-Cookie'][0], /Max-Age=2592000/);

    const remembered = await auth.authenticate({
      headers: { cookie: '__Host-kd_session=' + encodeURIComponent(rememberToken) }
    });
    assert.equal(remembered.user.id, user.id);
    assert.equal(remembered.rememberMe, true);

    await auth.revokeSession(rememberToken);
    assert.equal(await auth.authenticate({
      headers: { cookie: '__Host-kd_session=' + encodeURIComponent(rememberToken) }
    }), null);

    console.log('KerjaDesa auth session tests: PASS');
  } finally {
    store.remove('users', user.id);
  }
}

main().catch(error => {
  console.error('KerjaDesa auth session tests: FAIL');
  console.error(error);
  process.exitCode = 1;
});
