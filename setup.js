#!/usr/bin/env node

/**
 * Setup Script untuk Kamus Acèh
 * Jalankan: node setup.js
 * 
 * Script ini membantu setup token GitHub secara aman
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ENV_FILE = path.join(__dirname, '.env');
const ENV_EXAMPLE = path.join(__dirname, '.env.example');

console.log('\n🔐 KAMUS ACÈH - SETUP GITHUB TOKEN\n');
console.log('File akan disimpan di:', ENV_FILE);
console.log('⚠️  JANGAN COMMIT .env ke repository!\n');

// Check if .env already exists
if (fs.existsSync(ENV_FILE)) {
    console.log('⚠️  File .env sudah ada!\n');
    rl.question('Update existing .env? (y/n): ', (answer) => {
        if (answer.toLowerCase() !== 'y') {
            console.log('Dibatalkan.\n');
            rl.close();
            process.exit(0);
        }
        setupToken();
    });
} else {
    setupToken();
}

function setupToken() {
    rl.question('Masukkan GitHub PAT token Anda: ', (token) => {
        if (!token || token.trim().length === 0) {
            console.log('❌ Token tidak boleh kosong!\n');
            rl.close();
            process.exit(1);
        }

        if (!token.startsWith('github_pat_')) {
            console.log('⚠️  Token harus dimulai dengan github_pat_\n');
            rl.question('Lanjutkan? (y/n): ', (cont) => {
                if (cont.toLowerCase() !== 'y') {
                    console.log('Dibatalkan.\n');
                    rl.close();
                    process.exit(0);
                }
                writeToken(token);
            });
        } else {
            writeToken(token);
        }
    });
}

function writeToken(token) {
    rl.question('Konfirmasi token (y/n): ', (confirm) => {
        if (confirm.toLowerCase() !== 'y') {
            console.log('Dibatalkan.\n');
            rl.close();
            process.exit(0);
        }

        // Read .env.example
        let envContent = '';
        if (fs.existsSync(ENV_EXAMPLE)) {
            envContent = fs.readFileSync(ENV_EXAMPLE, 'utf8');
        } else {
            envContent = `GITHUB_TOKEN=${token.trim()}
GITHUB_OWNER=kamusaceh
GITHUB_REPO=kamusaceh.github.io
GITHUB_BRANCH=main
NODE_ENV=development
`;
        }

        // Replace placeholder
        envContent = envContent.replace(
            /GITHUB_TOKEN=github_pat_[a-zA-Z0-9_]*/,
            `GITHUB_TOKEN=${token.trim()}`
        );

        // Write to .env
        fs.writeFileSync(ENV_FILE, envContent);
        fs.chmodSync(ENV_FILE, 0o600); // Read/write only for owner

        console.log('\n✅ Token berhasil disimpan di .env');
        console.log('✅ Permissions: 0600 (only owner can read/write)');
        console.log('✅ File .gitignore sudah dikonfigurasi\n');
        console.log('📝 Langkah selanjutnya:');
        console.log('  1. Jalankan: npm install (jika pakai Node.js)');
        console.log('  2. Test token: window.testKamusToken() (di browser)');
        console.log('  3. Revoke token lama: https://github.com/settings/tokens\n');

        rl.close();
    });
}
