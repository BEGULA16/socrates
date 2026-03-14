const fs = require('fs');
const dgram = require('dgram');
const { execSync } = require('child_process');

const IP = "vxl.bot.nu";
const PORT = 25686;
const FILE_PATH = 'uptime.json';

function pingBedrock() {
    return new Promise((resolve) => {
        const client = dgram.createSocket('udp4');
        let isResolved = false;

     
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                client.close();
                resolve(false);
            }
        }, 4000); 

     
        const UNCONNECTED_PING = Buffer.from([
            0x01, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78 // Magic
        ]);

        client.on('message', () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                client.close();
                resolve(true);
            }
        });

        client.on('error', () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                client.close();
                resolve(false);
            }
        });

     
        client.send(UNCONNECTED_PING, PORT, IP, (err) => {
            if (err && !isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                client.close();
                resolve(false);
            }
        });
    });
}


async function monitor() {
    console.log(`Starting High-Frequency Monitor for ${IP}:${PORT}`);

    let history = [];
    if (fs.existsSync(FILE_PATH)) {
        try {
            history = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
        } catch (e) {
            console.log("Could not parse old history, starting fresh.");
        }
    }

    let lastRecord = history.length > 0 ? history[history.length - 1] : null;


    for (let i = 0; i < 4; i++) {
        const isOnline = await pingBedrock();
        console.log(`[Check ${i+1}/4] Server is ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

        if (!lastRecord || lastRecord.online !== isOnline) {
            console.log(`>>> STATUS CHANGED to ${isOnline ? 'ONLINE' : 'OFFLINE'}! Saving and pushing immediately...`);
            
            const newRecord = { timestamp: Date.now(), online: isOnline };
            history.push(newRecord);
            lastRecord = newRecord;

     
            if (history.length > 1000) history.shift();
            fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2));

           
            try {
                execSync('git config --global user.name "github-actions[bot]"');
                execSync('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
                execSync('git pull --rebase'); 
                execSync(`git add ${FILE_PATH}`);
                execSync('git commit -m "Auto-update status change [High-Frequency]"');
                execSync('git push');
                console.log("Successfully committed and pushed to GitHub!");
            } catch(err) {
                console.log("Git push failed. (Might be a sync conflict, will try again next minute).");
            }
        } else {
            console.log(`Status unchanged. Skipping save.`);
        }

     
        if (i < 3) await new Promise(r => setTimeout(r, 14000));
    }
    console.log("1-Minute cycle complete. GitHub Actions will restart this shortly.");
}

monitor();
