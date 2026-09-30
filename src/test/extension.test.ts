import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
	runGitCommand,
	getGitErrorMessage,
	isGitRepository,
	hasStagedChanges,
	stageAll,
	commit,
	push,
} from '../git';

suite('Git Tests', () => {

	test('getGitErrorMessage returns stderr when available', () => {
		const error = {
			stderr: 'fatal: repository not found',
		};

		const message = getGitErrorMessage(
			error,
			'Fallback error'
		);

		assert.strictEqual(
			message,
			'fatal: repository not found'
		);
	});

	test('getGitErrorMessage returns fallback when stderr is empty', () => {
		const error = {
			stderr: '',
		};

		const message = getGitErrorMessage(
			error,
			'Fallback error'
		);

		assert.strictEqual(
			message,
			'Fallback error'
		);
	});

	test('getGitErrorMessage returns fallback for unknown errors', () => {
		const message = getGitErrorMessage(
			new Error('Something went wrong'),
			'Fallback error'
		);

		assert.strictEqual(
			message,
			'Fallback error'
		);
	});

	test('isGitRepository returns true for the extension project', async () => {
		const result = await isGitRepository(process.cwd());

		assert.strictEqual(result, true);
	});

	test('isGitRepository returns false for a non-Git directory', async () => {
		const result = await isGitRepository(os.tmpdir());

		assert.strictEqual(result, false);
	});

	test('hasStagedChanges returns false when nothing is staged', async () => {
		const repo = createTempRepository();

		try {
			createFile(repo, 'test.txt', 'hello');

			const result = await hasStagedChanges(repo);

			assert.strictEqual(result, false);
		} finally {
			removeDirectory(repo);
		}
	});

	test('hasStagedChanges returns true when a file is staged', async () => {
		const repo = createTempRepository();

		try {
			createFile(repo, 'test.txt', 'hello');

			await stageAll(repo);

			const result = await hasStagedChanges(repo);

			assert.strictEqual(result, true);
		} finally {
			removeDirectory(repo);
		}
	});

	test('stageAll stages files in the repository', async () => {
		const repo = createTempRepository();

		try {
			createFile(repo, 'test.txt', 'hello');

			await stageAll(repo);

			const result = await hasStagedChanges(repo);

			assert.strictEqual(result, true);
		} finally {
			removeDirectory(repo);
		}
	});

	test('commit creates a commit with the provided message', async () => {
		const repo = createTempRepository();

		try {
			createFile(repo, 'test.txt', 'hello');

			await stageAll(repo);
			await commit(repo, 'Test commit');

			const result = await runGitCommand(
				'log',
				['-1', '--pretty=%s'],
				repo
			);

			assert.strictEqual(
				result.stdout.trim(),
				'Test commit'
			);
		} finally {
			removeDirectory(repo);
		}
	});

	test('push pushes commits to a remote repository', async () => {
		const repo = createTempRepository();
		const remote = fs.mkdtempSync(
			path.join(os.tmpdir(), 'commit-exe-remote-')
		);

		try {
			await runGitCommand('init', ['--bare'], remote);

			await runGitCommand(
				'remote',
				['add', 'origin', remote],
				repo
			);

			createFile(repo, 'test.txt', 'hello');

			await stageAll(repo);
			await commit(repo, 'Initial commit');

			await runGitCommand(
				'push',
				['-u', 'origin', 'HEAD'],
				repo
			);

			createFile(repo, 'test.txt', 'updated');

			await stageAll(repo);
			await commit(repo, 'Second commit');

			await push(repo);

			const result = await runGitCommand(
				'log',
				['-1', '--pretty=%s'],
				remote
			);

			assert.strictEqual(
				result.stdout.trim(),
				'Second commit'
			);
		} finally {
			removeDirectory(repo);
			removeDirectory(remote);
		}
	});
});

function createTempRepository(): string {
	const repo = fs.mkdtempSync(
		path.join(os.tmpdir(), 'commit-exe-test-')
	);

	runGitCommandSync('init', [], repo);
	runGitCommandSync(
		'config',
		['user.name', 'Commit.exe Tests'],
		repo
	);
	runGitCommandSync(
		'config',
		['user.email', 'tests@commit.exe'],
		repo
	);

	return repo;
}

function createFile(
	repo: string,
	filename: string,
	content: string
): void {
	fs.writeFileSync(
		path.join(repo, filename),
		content
	);
}

function removeDirectory(directory: string): void {
	try {
		fs.rmSync(directory, {
			recursive: true,
			force: true,
			maxRetries: 5,
			retryDelay: 100,
		});
	} catch {
		// Ignore cleanup errors on Windows.
	}
}

function runGitCommandSync(
	command: string,
	args: string[],
	cwd: string
): void {
	const { execFileSync } = require('child_process');

	execFileSync(
		'git',
		[command, ...args],
		{
			cwd,
			stdio: 'ignore',
		}
	);
}