#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const pgzodDir = path.join(__dirname, '../src/schemas/pgzod');

function findTsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findTsFiles(filePath, fileList);
        } else if (file.endsWith('.ts')) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function fixInt8() {
    try {
        if (!fs.existsSync(pgzodDir)) {
            console.log(`Directory ${pgzodDir} does not exist, skipping fix`);
            return;
        }

        const files = findTsFiles(pgzodDir);

        for (const file of files) {
            let content = fs.readFileSync(file, 'utf8');
            const originalContent = content;

            // Replace z.int8() with z.number().int()
            content = content.replace(/z\.int8\(\)/g, 'z.number().int()');

            if (content !== originalContent) {
                fs.writeFileSync(file, content, 'utf8');
                console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
            }
        }

        if (files.length > 0) {
            console.log('Finished fixing int8 types');
        }
    } catch (error) {
        console.error('Error fixing int8 types:', error);
        process.exit(1);
    }
}

fixInt8();

