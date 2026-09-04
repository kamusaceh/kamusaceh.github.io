# 🔐 Kamus Acèh - Security & Token Setup

## ✅ Token Configuration - READY

**Test Token Status:** ✅ Configured  
**Token Location:** `config/app-config.js`  
**Version:** 1.2.0

---

## 🧪 Test Token Usage

### Browser Console
```javascript
// 1. Check token
window.testKamusToken();

// Expected output:
// Token Format: ✅ Valid
// Token Length: 89
// Token Preview: github_pat_11CNLI6WY0zWJib...

// 2. Get config
console.log(window.KAMUS_CONFIG);

// 3. Get version
console.log(window.getKamusVersion());
```

### Available Helper Functions
```javascript
// Set new token
window.setKamusToken('github_pat_new_token_here');

// Remove token
window.removeKamusToken();

// Test token
window.testKamusToken();  // Returns: true/false

// Get config
window.getKamusConfig();

// Get version info
window.getKamusVersion();
```

---

## 📋 Token Details

| Property | Value |
|----------|-------|
| Format | `github_pat_*` |
| Length | 89 characters |
| Type | Personal Access Token (Classic) |
| Status | Test token (configured) |
| Revoke | https://github.com/settings/tokens |

---

## 📝 File Structure

```
config/
├── app-config.js          ← Token configured here
└── app-config.local.js    ← Override locally (git excluded)

.env                        ← Local only (git excluded)
.env.example               ← Template (safe to commit)
.gitignore                 ← Exclude rules

setup.js                   ← Setup wizard (run: node setup.js)
SECURITY.md               ← This file
```

---

## 🚀 Quick Test

**Buka website, tekan F12, jalankan:**

```javascript
// Test 1: Verify config loaded
console.log('Config:', window.KAMUS_CONFIG.version || 'v1.2.0');

// Test 2: Test token
window.testKamusToken();

// Test 3: Check localStorage
console.log('Stored:', localStorage.getItem('kamus_github_token'));

// Test 4: Set new token (jika perlu)
window.setKamusToken('github_pat_your_token_here');
```

---

## 🔄 Token Loading Priority

Token dimuat dari sumber ini (urutan prioritas):

1. **Environment Variable** (`process.env.GITHUB_TOKEN`)
2. **Window Environment** (`window.ENV_GITHUB_TOKEN`)
3. **localStorage** (user-stored)
4. **Script Data Attribute** (`data-token`)
5. **Config Default** (hardcoded - current status)

---

## 🛡️ Security Best Practices

✅ **DO:**
- Use environment variables in production
- Rotate tokens regularly (90-day expiration)
- Use minimal required permissions
- Store .env locally only (git-excluded)
- Revoke compromised tokens immediately

❌ **DON'T:**
- Commit .env to repository
- Share tokens in chat/email
- Use tokens with excessive permissions
- Keep tokens without expiration
- Reuse tokens across projects

---

## 🔧 Production Setup

### Option 1: Environment Variables
```bash
# Server environment
export GITHUB_TOKEN=github_pat_xxx...
```

### Option 2: GitHub Secrets (CI/CD)
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Option 3: Backend Server
```python
# server/.env
GITHUB_TOKEN=github_pat_xxx...

# app.py
token = os.getenv('GITHUB_TOKEN')
```

---

## 📊 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2024-09-04 | Add test token config + helpers |
| 1.1.0 | 2024-09-04 | Login system implementation |
| 1.0.0 | 2024-09-04 | Initial release |

---

## 🆘 Troubleshooting

### Token not loading
```javascript
// Check if config exists
console.log(window.KAMUS_CONFIG);

// Check token
console.log(window.KAMUS_CONFIG.token);

// Test validation
window.testKamusToken();
```

### Token format invalid
```javascript
// Token must start with github_pat_
const token = '...';
console.log(token.startsWith('github_pat_'));  // Should be true
```

### Token expired
1. Go to: https://github.com/settings/tokens
2. Find expired token
3. Click "Regenerate" or generate new
4. Update config/localStorage

### Need to replace token
```javascript
// In browser console
window.setKamusToken('github_pat_new_token_here');

// Verify
window.testKamusToken();
```

---

## 🔗 Resources

- [GitHub PAT Docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Token Permissions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [API Documentation](https://docs.github.com/en/rest)
- [Security Best Practices](https://github.com/settings/security)

---

## ✅ Checklist

- [x] Token configured in config/app-config.js
- [x] .gitignore includes .env
- [x] Helper functions added
- [x] Version updated to 1.2.0
- [x] Documentation complete

---

**Status:** ✅ READY FOR TESTING  
**Last Updated:** 2024-09-04  
**Current Version:** 1.2.0

Test token is configured and ready to use! 🚀
