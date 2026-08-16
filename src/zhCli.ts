import * as cp from 'child_process';

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export class ZhCliError extends Error {}

/** Thin wrapper around the zh CLI. All mutations go through zh. */
export class ZhCli {
  constructor(
    private readonly bin: string,
    private readonly cwd: string
  ) {}

  run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      cp.execFile(
        this.bin,
        args,
        { cwd: this.cwd, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          const out = String(stdout).replace(ANSI_PATTERN, '').trim();
          const err = String(stderr).replace(ANSI_PATTERN, '').trim();
          if (error) {
            const detail = [err, out].filter(Boolean).join('\n');
            reject(new ZhCliError(detail || error.message));
          } else {
            resolve(out);
          }
        }
      );
    });
  }
}
