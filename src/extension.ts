import * as vscode from 'vscode';
import { execFile } from 'child_process';

interface GitCommandError {
	error: Error;
	stdout: string;
	stderr: string;
}

function runGitCommand(
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

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(
		'commit-exe.commit',
		async () => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

			if (!workspaceFolder) {
				vscode.window.showErrorMessage(
					'Commit.exe: No workspace is open.'
				);
				return;
			}

			const cwd = workspaceFolder.uri.fsPath;


			// Check if Git is installed
			try {
				await runGitCommand('--version', [], cwd);
			} catch {
				vscode.window.showErrorMessage(
					'Commit.exe: Git is not installed or could not be found.'
				);
				return;
			}

			// Check if this is a Git repository
			try {
				await runGitCommand(
					'rev-parse',
					['--is-inside-work-tree'],
					cwd
				);
			} catch {
				vscode.window.showErrorMessage(
					'Commit.exe: The current workspace is not a Git repository.'
				);
				return;
			}

			// Check for staged changes
			let stagedChanges = '';

			try {
				const result = await runGitCommand(
					'diff',
					['--cached', '--name-only'],
					cwd
				);

				stagedChanges = result.stdout.trim();
			} catch {
				vscode.window.showErrorMessage(
					'Commit.exe: Failed to check Git status.'
				);
				return;
			}

			// If nothing is staged, stage all changes
			if (!stagedChanges) {
				try {
					await runGitCommand('add', ['.'], cwd);
				} catch {
					vscode.window.showErrorMessage(
						'Commit.exe: Failed to stage changes.'
					);
					return;
				}
			}

			// Check whether there are actually changes to commit
			try {
				const result = await runGitCommand(
					'diff',
					['--cached', '--name-only'],
					cwd
				);

				if (!result.stdout.trim()) {
					vscode.window.showInformationMessage(
						'Commit.exe: There are no changes to commit.'
					);
					return;
				}
			} catch {
				vscode.window.showErrorMessage(
					'Commit.exe: Failed to check staged changes.'
				);
				return;
			}

			// Ask for commit message
			const message = await vscode.window.showInputBox({
				prompt: 'Enter your commit message',
				placeHolder: 'e.g. Add user authentication',
				ignoreFocusOut: true,
			});

			if (message === undefined) {
				return;
			}

			if (!message.trim()) {
				vscode.window.showErrorMessage(
					'Commit.exe: Commit message cannot be empty.'
				);
				return;
			}

			// Commit
			try {
				await runGitCommand(
					'commit',
					['-m', message],
					cwd
				);
			} catch (result: any) {
				const errorMessage =
					result.stderr?.trim() ||
					'Commit failed.';

				vscode.window.showErrorMessage(
					`Commit.exe: ${errorMessage}`
				);
				return;
			}

			const config = vscode.workspace.getConfiguration('commit-exe');
			const autoPush = config.get<boolean>('autoPush', true);

			if (!autoPush) {
				vscode.window.showInformationMessage(
					'Commit.exe: Commit created successfully.'
				);
				return;
			}

			try {
				await runGitCommand('push', [], cwd);

				vscode.window.showInformationMessage(
					'Commit.exe: Commit and push completed successfully.'
				);
			} catch (result: any) {
				const errorMessage =
					result.stderr?.trim() ||
					'Push failed.';

				vscode.window.showErrorMessage(
					`Commit.exe: Commit created, but push failed: ${errorMessage}`
				);
			}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}