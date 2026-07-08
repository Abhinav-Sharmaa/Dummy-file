<?php
declare(strict_types=1);

/**
 * shell_exec bridge. The run id is the ONLY value interpolated into the command
 * line, and it is both format-validated (valid_run_id) and shell-escaped on
 * POSIX / regex-constrained on Windows. Ticket text and URL never touch the
 * shell — the runner reads them from the run's JSON file on disk.
 */
final class Runner
{
    public static function launch(string $runId): void
    {
        $log = RUNS_DIR . '/' . $runId . '.runner.log';

        if (PHP_OS_FAMILY === 'Windows') {
            // $runId matched ^[0-9]{8}-[0-9]{6}-[a-f0-9]{6}$ upstream; the other
            // segments are server-side constants.
            $dir = str_replace('/', DIRECTORY_SEPARATOR, RUNNER_DIR);
            $out = str_replace('/', DIRECTORY_SEPARATOR, $log);
            $cmd = sprintf(
                'cd /D "%s" && start /B "" "%s" run.js --run %s > "%s" 2>&1',
                $dir,
                NODE_BIN,
                $runId,
                $out
            );
            pclose(popen($cmd, 'r'));
            return;
        }

        $cmd = sprintf(
            'cd %s && nohup %s run.js --run %s > %s 2>&1 & echo $!',
            escapeshellarg(RUNNER_DIR),
            escapeshellarg(NODE_BIN),
            escapeshellarg($runId),
            escapeshellarg($log)
        );
        shell_exec($cmd);
    }

    public static function log(string $runId): string
    {
        $path = RUNS_DIR . '/' . $runId . '.runner.log';
        return is_file($path) ? (string) file_get_contents($path) : '';
    }
}
