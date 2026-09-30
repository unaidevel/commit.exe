import { execFile } from 'child_process';


export function runGitCommand(
    command: string,
    args: string[],
    cwd: string
): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile('git', [command, ...args], { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject({
                    error,
                    stdout,
                    stderr,
                });
                return;
            }

            resolve({
                stdout,
                stderr,
            });
        });
    });
}

export async function isGitRepository(cwd: string): Promise<boolean> {
	try {
		await runGitCommand(
			'rev-parse',
			['--is-inside-work-tree'],
			cwd
		);

		return true;
	} catch {
		return false;
	}
}

export async function hasStagedChanges(cwd: string): Promise<boolean> {
	const result = await runGitCommand(
		'diff',
		['--cached', '--name-only'],
		cwd
	);

	return Boolean(result.stdout.trim());
}

export async function stageAll(cwd: string): Promise<void> {
	await runGitCommand('add', ['.'], cwd);
}

export async function commit(
	cwd: string,
	message: string
): Promise<void> {
	await runGitCommand(
		'commit',
		['-m', message],
		cwd
	);
}

export async function push(cwd: string): Promise<void> {
	await runGitCommand('push', [], cwd);
}