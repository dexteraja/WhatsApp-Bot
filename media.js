// ============================================================
//  media.js — Advanced Sticker Engine
// ============================================================
const fs = require('fs');
const { exec } = require('child_process');
const { getRandom } = require('./utils'); // Asumsi ada fungsi random penamaan file

// Fungsi eksekusi FFMPEG untuk Video/GIF ke WebP
async function videoToWebp(mediaPath) {
    const outputPath = `./temp/${getRandom('.webp')}`;
    return new Promise((resolve, reject) => {
        // Argumen ini memastikan video dipotong ke ukuran kotak, fps 15 (agar ringan), dan batas max 10 detik (-t 10)
        exec(`ffmpeg -i ${mediaPath} -t 10 -vcodec libwebp -filter_complex "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,fps=15, pad=512:512:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" -loop 0 -vsync 0 -preset default ${outputPath}`, (err) => {
            if (err) return reject(err);
            resolve(outputPath);
        });
    });
}

// Fungsi eksekusi FFMPEG untuk Gambar biasa ke WebP
async function imageToWebp(mediaPath) {
    const outputPath = `./temp/${getRandom('.webp')}`;
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${mediaPath} -vcodec libwebp -filter_complex "scale='min(512,iw)':'min(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0.0" ${outputPath}`, (err) => {
            if (err) return reject(err);
            resolve(outputPath);
        });
    });
}

// Handler !stiker (Image/Video/GIF)
async function cmdStiker(bot, msg) {
    const isImage = msg.type === 'imageMessage';
    const isVideo = msg.type === 'videoMessage';
    const isQuotedImage = msg.isQuotedImage;
    const isQuotedVideo = msg.isQuotedVideo;

    if (isImage || isQuotedImage) {
        // Download media logic (sesuaikan dengan library WASocket/Baileys kamu)
        const media = await bot.downloadMediaMessage(msg);
        const webp = await imageToWebp(media);
        await bot.sendMessage(msg.chat, { sticker: { url: webp } });
        fs.unlinkSync(webp); // Bersihkan file temp
    } 
    else if (isVideo || isQuotedVideo) {
        // Cek durasi jika ada dalam metadata pesan
        if (msg.message.videoMessage && msg.message.videoMessage.seconds > 10) {
            return bot.reply(msg.chat, "❌ Durasi video/GIF maksimal 10 detik ya!");
        }
        
        const media = await bot.downloadMediaMessage(msg);
        const webp = await videoToWebp(media);
        await bot.sendMessage(msg.chat, { sticker: { url: webp } });
        fs.unlinkSync(webp);
    } 
    else {
        return bot.reply(msg.chat, "❌ Kirim/reply gambar atau video/GIF dengan caption *!stiker*");
    }
}

// Handler !stiker2 (Sticker to Image)
async function cmdStikerToImage(bot, msg) {
    if (!msg.isQuotedSticker) return bot.reply(msg.chat, "❌ Reply stiker yang mau dijadikan gambar dengan caption *!stiker2*");
    
    // Download stiker
    const media = await bot.downloadMediaMessage(msg.quoted);
    const outputPath = `./temp/${getRandom('.jpg')}`;
    
    // Konversi WebP ke JPG
    return new Promise((resolve, reject) => {
        exec(`ffmpeg -i ${media} ${outputPath}`, async (err) => {
            if (err) return reject(err);
            await bot.sendMessage(msg.chat, { image: { url: outputPath }, caption: "🖼️ Ini gambarnya!" });
            fs.unlinkSync(outputPath);
            fs.unlinkSync(media);
            resolve();
        });
    });
}

module.exports = { cmdStiker, cmdStikerToImage };