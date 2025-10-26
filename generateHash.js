const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('=== Password Hash Generator ===\n');

rl.question('Enter the password you want to use for your server: ', async (password) => {
    if (!password || password.trim() === '') {
        console.log('\nError: Password cannot be empty!');
        rl.close();
        return;
    }

    try {
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        console.log('\n=== Generated Hash ===');
        console.log('Add this to your .env file as PASSWORD_HASH:\n');
        console.log(hash);
        console.log('\nExample .env file:');
        console.log('PORT=3000');
        console.log('SESSION_SECRET=your-random-session-secret');
        console.log(`PASSWORD_HASH=${hash}`);
        console.log('\nDone! Remember to keep your .env file secure and never commit it to version control.');

    } catch (error) {
        console.error('\nError generating hash:', error);
    }

    rl.close();
});
