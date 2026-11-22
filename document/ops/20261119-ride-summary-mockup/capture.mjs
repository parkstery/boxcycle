const task=await taskSpace(8);const page=task.page('p1');
const shot=await page.cdp('Page.captureScreenshot',{format:'png',fromSurface:false,captureBeyondViewport:false});
const fs=await import('node:fs/promises');await fs.writeFile('C:/20.HDev/boxcycle/document/ops/20261119-ride-summary-mockup/preview.png',Buffer.from(shot.data,'base64'));console.log('Saved preview.png');
