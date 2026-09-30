import * as vscode from 'vscode';
import {
	runGitCommand,
	isGitRepository,
	hasStagedChanges,
	stageAll,
	commit,
	push,
	getGitErrorMessage,
} from './git';

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
			if (!(await isGitRepository(cwd))) {
				vscode.window.showErrorMessage(
					'Commit.exe: The current workspace is not a Git repository.'
				);
				return;
			}

			// Check for staged changes
			let stagedChanges = false;

			try {
				stagedChanges = await hasStagedChanges(cwd);
			} catch {
				vscode.window.showErrorMessage(
					'Commit.exe: Failed to check Git status.'
				);
				return;
			}

			// If nothing is staged, stage all changes
			if (!stagedChanges) {
				try {
					await stageAll(cwd);
				} catch {
					vscode.window.showErrorMessage(
						'Commit.exe: Failed to stage changes.'
					);
					return;
				}
			}

			// Check whether there are actually changes to commit
			try {
				if (!(await hasStagedChanges(cwd))) {
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
				await commit(cwd, message);
			} catch (error) {
				const errorMessage = getGitErrorMessage(
					error,
					'Commit failed.'
				);

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
				await push(cwd);

				vscode.window.showInformationMessage(
					'Commit.exe: Commit and push completed successfully.'
				);
			} catch (error) {
			const errorMessage = getGitErrorMessage(
				error,
				'Push failed.'
			);

			vscode.window.showErrorMessage(
				`Commit.exe: Commit created, but push failed: ${errorMessage}`
			);
		}
		}
	);

	context.subscriptions.push(disposable);
}

export function deactivate() {}