// Drives headless Chrome through the Hitbox 3D login and captures gameplay
// screenshots. Run with: npx tsx test/screenshot3d.ts
import { spawn } from "child_process";
import { writeFileSync } from "fs";
import WebSocket from "ws";
import http from "http";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getJson(path: string): Promise<any> {
    return new Promise((resolve, reject) => {
        http.get({ host: "localhost", port: PORT, path }, res => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => resolve(JSON.parse(data)));
        }).on("error", reject);
    });
}

async function main(){
    const chrome = spawn(CHROME, [
        "--headless", "--disable-gpu", "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
        "--window-size=1440,900", `--remote-debugging-port=${PORT}`,
        "--no-first-run", "--user-data-dir=/tmp/hitbox3d-chrome-profile",
        "about:blank"
    ], { stdio: "ignore" });

    try {
        let targets: any[] = [];
        for(let i = 0; i < 30; i++){
            try {
                targets = await getJson("/json");
                if(targets.some((t: any) => t.type === "page")) break;
            } catch (e) { }
            await sleep(500);
        }
        const page = targets.find((t: any) => t.type === "page");
        if(!page) throw new Error("no page target");

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.on("open", r));
        let nextId = 1;
        const pending = new Map<number, (v: any) => void>();
        ws.on("message", (raw: any) => {
            const message = JSON.parse(raw.toString());
            if(message.id && pending.has(message.id)){
                pending.get(message.id)(message);
                pending.delete(message.id);
            }
        });
        const send = (method: string, params: any = {}) => new Promise<any>(resolve => {
            const id = nextId++;
            pending.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
        });

        await send("Page.enable");
        await send("Runtime.enable");
        const url = process.argv[2] || "http://localhost:3000/3d";
        await send("Page.navigate", { url });
        await sleep(8000);

        const shoot = async (name: string) => {
            const shot = await send("Page.captureScreenshot", { format: "png" });
            writeFileSync(`/tmp/${name}.png`, Buffer.from(shot.result.data, "base64"));
            console.log("saved /tmp/" + name + ".png");
        };

        // Click "Play Anonymously".
        const click = await send("Runtime.evaluate", { expression: `
            (() => {
                const button = [...document.querySelectorAll('button')].find(b => /play/i.test(b.textContent));
                if(button){ button.click(); return "clicked: " + button.textContent.trim(); }
                return "no play button; buttons: " + [...document.querySelectorAll('button')].map(b => b.textContent.trim()).join("|");
            })()
        ` });
        console.log(click.result?.result?.value);

        await sleep(7000);
        await shoot("hitbox3d-game1");

        // Join the match proper and hold W to run forward.
        const join = await send("Runtime.evaluate", { expression: `
            (() => {
                const button = [...document.querySelectorAll('button')].find(b => /join/i.test(b.textContent));
                if(button){ button.click(); return "clicked: " + button.textContent.trim(); }
                return "no join button";
            })()
        ` });
        console.log(join.result?.result?.value);
        await sleep(5000);

        // Run briefly (not off the island), then zoom right in on the character.
        await send("Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 87, code: "KeyW", key: "w" });
        await sleep(450);
        await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 87, code: "KeyW", key: "w" });
        await send("Runtime.evaluate", { expression: `
            window.dispatchEvent(new WheelEvent('wheel', { deltaY: -3000 }));
        ` });
        await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 720, y: 400, deltaX: 0, deltaY: -3000 });
        await sleep(400);
        await shoot("hitbox3d-game2");
        await sleep(2500);
        await shoot("hitbox3d-game3");

        const probe = await send("Runtime.evaluate", { expression: `
            (() => {
                const canvas = document.querySelector('canvas');
                return JSON.stringify({ canvas: !!canvas, size: canvas ? canvas.width + 'x' + canvas.height : null });
            })()
        ` });
        console.log(probe.result?.result?.value);
        ws.close();
    } finally {
        chrome.kill();
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
