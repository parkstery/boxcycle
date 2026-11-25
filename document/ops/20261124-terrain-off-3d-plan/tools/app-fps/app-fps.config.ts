export default {
  testDir: '.', testMatch: 'app-fps.spec.ts', timeout: 300000, workers: 1, retries: 0, reporter: 'line',
  outputDir: 'C:/20.HDev/boxcycle/tmp/view-distance/app-results',
  use: {
    baseURL: 'http://127.0.0.1:5231', channel: 'msedge', headless: true, viewport: { width: 1562, height: 754 },
    launchOptions: { args: ['--use-angle=d3d11', '--disable-frame-rate-limit', '--disable-gpu-vsync'] },
  },
};
