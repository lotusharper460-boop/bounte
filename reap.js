const fs = require('fs');
const path = require('path');

// 1. Where to save the output
const outputFile = path.join(__dirname, 'compiled_workspace.txt');

// 2. Folders and files to completely ignore
const ignoreList = [
    'node_modules', 
    '.next', 
    '.git', 
    'public', // Ignore images/fonts
    'reap.js', // Ignore this script itself
    'package-lock.json',
    '.env.local' // NEVER share your secret keys!
];

// 3. Only grab files with these extensions
const allowedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.json'];

let resultText = '';

function reapDirectory(currentPath) {
    const items = fs.readdirSync(currentPath);

    for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const relativePath = path.relative(__dirname, fullPath);

        // Check if we should ignore this file/folder
        if (ignoreList.some(ignoreItem => relativePath.startsWith(ignoreItem))) {
            continue;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            reapDirectory(fullPath); // Search inside folders
        } else if (stat.isFile() && allowedExtensions.includes(path.extname(fullPath))) {
            // It's a valid code file! Add its name and contents to our big text blob
            console.log(`Reaping: ${relativePath}`);
            const content = fs.readFileSync(fullPath, 'utf-8');
            resultText += `\n\n========================================\n`;
            resultText += `FILE: ${relativePath}\n`;
            resultText += `========================================\n\n`;
            resultText += content;
        }
    }
}

console.log('Starting the harvest...');
try {
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); // Delete old file if it exists
    reapDirectory(__dirname);
    fs.writeFileSync(outputFile, resultText, 'utf-8');
    console.log(`\n✅ Success! All your code has been compiled into: ${outputFile}`);
} catch (error) {
    console.error('Error during reaping:', error);
}