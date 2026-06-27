/**
 * convert-frames.js
 * Converts all JPG frame sequences to WebP (quality 72) in-place.
 * Run: node convert-frames.js
 * Outputs: images/frame_0001.webp, images1/frame_0001.webp, etc.
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const DIRS    = ['images', 'images1', 'images3', 'images4', 'images5', 'mobile frames'];
const QUALITY = 72;   // WebP quality — visually lossless for interior photos
const CONCURRENCY = 8; // parallel conversions

async function convertDir(dir) {
    const full = path.join(__dirname, dir);
    if (!fs.existsSync(full)) return;

    const files = fs.readdirSync(full).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    console.log(`\n[${dir}] Converting ${files.length} files…`);

    let done = 0;
    const queue = [...files];

    const worker = async () => {
        while (queue.length) {
            const file = queue.shift();
            const src  = path.join(full, file);
            const dest = path.join(full, file.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
            if (fs.existsSync(dest)) { done++; continue; }
            try {
                await sharp(src).webp({ quality: QUALITY, effort: 4 }).toFile(dest);
                done++;
                if (done % 20 === 0) process.stdout.write(`  ${done}/${files.length}\r`);
            } catch (e) {
                console.error(`  Error: ${file}`, e.message);
            }
        }
    };

    const workers = Array.from({ length: CONCURRENCY }, worker);
    await Promise.all(workers);
    console.log(`  ✓ ${done}/${files.length} done`);
}

// Generate 36 evenly-distributed mobile frames from images/ at 960px wide
async function generateMobileFrames() {
    const srcDir  = path.join(__dirname, 'images');
    const destDir = path.join(__dirname, 'images-mobile');
    const MOBILE_COUNT  = 36;
    const MOBILE_WIDTH  = 960;
    const MOBILE_QUALITY = 68;

    if (!fs.existsSync(srcDir)) {
        console.log('\n[images-mobile] Source images/ not found, skipping.');
        return;
    }

    const allFrames = fs.readdirSync(srcDir)
        .filter(f => /\.webp$/i.test(f))
        .sort();

    if (allFrames.length === 0) {
        console.log('\n[images-mobile] No .webp frames found in images/, skipping.');
        return;
    }

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);

    const total = allFrames.length;
    console.log(`\n[images-mobile] Picking ${MOBILE_COUNT} frames from ${total} source frames at ${MOBILE_WIDTH}px…`);

    let done = 0;
    for (let i = 0; i < MOBILE_COUNT; i++) {
        // Evenly distributed index across all source frames
        const srcIdx  = Math.round(i * (total - 1) / (MOBILE_COUNT - 1));
        const srcFile = path.join(srcDir, allFrames[srcIdx]);
        const destFile = path.join(destDir, `frame_${String(i + 1).padStart(4, '0')}.webp`);

        if (fs.existsSync(destFile)) { done++; continue; }
        try {
            await sharp(srcFile)
                .resize(MOBILE_WIDTH, null, { withoutEnlargement: true })
                .webp({ quality: MOBILE_QUALITY, effort: 4 })
                .toFile(destFile);
            done++;
            process.stdout.write(`  ${done}/${MOBILE_COUNT}\r`);
        } catch (e) {
            console.error(`  Error: ${allFrames[srcIdx]}`, e.message);
        }
    }
    console.log(`  ✓ ${done}/${MOBILE_COUNT} mobile frames done → images-mobile/`);
}

(async () => {
    console.log('Starting WebP conversion…');
    for (const dir of DIRS) await convertDir(dir);
    await generateMobileFrames();
    console.log('\n✅ All conversions complete.');
})();
