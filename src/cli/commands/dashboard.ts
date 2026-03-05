import { Command } from 'commander';
import { startServer } from '../server/dashboard-server';

export const dashboardCommand = new Command('dashboard')
  .description('Starts a local web server to view switch-ai stats')
  .option('-p, --port <port>', 'Port to run the server on', '4000')
  .option('--no-open', 'Do not open the browser automatically')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log(`Starting dashboard server on port ${port}...`);

    // For now, we are not opening the browser.
    // We'll add that logic later.

    await startServer(port);
  });
