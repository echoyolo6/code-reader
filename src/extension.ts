// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// Interface to represent a novel file
interface NovelFile {
	path: string;
	content: string;
	index: number; // Current reading position
}

// Global variables to store the novel content and status bar item
let novelFiles: NovelFile[] = []; // Array to store multiple novel files
let currentNovelIndex: number = -1; // Index of the currently selected novel in the array
let statusBar: vscode.StatusBarItem;

// Helper function to get the currently selected novel
function getCurrentNovel(): NovelFile | undefined {
	if (currentNovelIndex >= 0 && currentNovelIndex < novelFiles.length) {
		return novelFiles[currentNovelIndex];
	}
	return undefined;
}

// Helper function to get the chunk size from configuration
function getChunkSize(): number {
	return vscode.workspace.getConfiguration('reader').get('chunkSize', 80);
}

// Helper function to truncate text to fit the status bar
function truncateTextForStatusBar(text: string): string {
	// Use a fixed effective chunk size that works well for most status bars
	const effectiveChunkSize = 50;
	
	if (text.length <= effectiveChunkSize) {
		return text;
	}
	
	// Truncate the text and add an ellipsis
	return text.substring(0, effectiveChunkSize - 3) + '...';
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "reader" is now active!');

	// Create a status bar item
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'reader.nextPage'; // Set command for clicking the status bar
	context.subscriptions.push(statusBar);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('reader.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from reader!');
	});

	// Register the command to select a novel file
	const selectNovelDisposable = vscode.commands.registerCommand('reader.selectNovel', async () => {
		// Open a file dialog to select a .txt file
		const options: vscode.OpenDialogOptions = {
			canSelectMany: true, // Allow selecting multiple files
			openLabel: 'Select Novel(s)',
			filters: {
				'Text files': ['txt']
			}
		};

		const fileUris = await vscode.window.showOpenDialog(options);
		if (fileUris && fileUris.length > 0) {
			// Process each selected file
			for (const fileUri of fileUris) {
				// Check if the file is already loaded
				const existingIndex = novelFiles.findIndex(novel => novel.path === fileUri.fsPath);
				if (existingIndex === -1) {
					// Read the content of the selected file
					const fileContent = await vscode.workspace.fs.readFile(fileUri);
					const content = Buffer.from(fileContent).toString('utf8');
					
					// Create a new NovelFile object
					const newNovel: NovelFile = {
						path: fileUri.fsPath,
						content: content,
						index: 0 // Start from the beginning
					};
					
					// Add the new novel to the array
					novelFiles.push(newNovel);
					
					// If this is the first file loaded, set it as the current novel
					if (currentNovelIndex === -1) {
						currentNovelIndex = 0;
					}
					
					vscode.window.showInformationMessage(`Loaded file: ${fileUri.fsPath}`);
				} else {
					vscode.window.showInformationMessage(`File ${fileUri.fsPath} is already loaded.`);
				}
			}
			
			// Display the content of the current novel in the status bar
			if (currentNovelIndex !== -1) {
				updateStatusBar();
				statusBar.show();
			}
		}
	});

	// Register the command for next page
	const nextPageDisposable = vscode.commands.registerCommand('reader.nextPage', () => {
		const currentNovel = getCurrentNovel();
		if (currentNovel) {
			const chunkSize = getChunkSize();
			currentNovel.index += chunkSize;
			if (currentNovel.index >= currentNovel.content.length) {
				currentNovel.index = 0; // Wrap around to the beginning
			}
			updateStatusBar();
			
			// Save the current reading position
			context.workspaceState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
		}
	});

	// Register the command for previous page
	const prevPageDisposable = vscode.commands.registerCommand('reader.prevPage', () => {
		const currentNovel = getCurrentNovel();
		if (currentNovel) {
			const chunkSize = getChunkSize();
			currentNovel.index -= chunkSize;
			if (currentNovel.index < 0) {
				// Wrap around to the end
				const totalPages = Math.ceil(currentNovel.content.length / chunkSize);
				currentNovel.index = (totalPages - 1) * chunkSize;
			}
			updateStatusBar();
			
			// Save the current reading position
			context.workspaceState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
		}
	});

	// Register the command for searching text in the novel
	const searchNovelDisposable = vscode.commands.registerCommand('reader.searchNovel', async () => {
		const currentNovel = getCurrentNovel();
		if (!currentNovel) {
			vscode.window.showErrorMessage('No novel is currently loaded. Please select a novel first.');
			return;
		}

		// Ask the user for the search term
		const searchTerm = await vscode.window.showInputBox({
			prompt: 'Enter the text to search for',
			placeHolder: 'Search text...'
		});

		if (searchTerm) {
			// Perform the search
			const index = currentNovel.content.indexOf(searchTerm, currentNovel.index + 1); // Start searching from the next character
			if (index !== -1) {
				// Found the text, jump to its position
				currentNovel.index = index;
				updateStatusBar();
				
				// Save the current reading position
				context.workspaceState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
				
				vscode.window.showInformationMessage(`Found '${searchTerm}' at position ${index}.`);
			} else {
				// Text not found from current position, search from the beginning
				const indexFromStart = currentNovel.content.indexOf(searchTerm);
				if (indexFromStart !== -1) {
					currentNovel.index = indexFromStart;
					updateStatusBar();
					
					// Save the current reading position
					context.workspaceState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
					
					vscode.window.showInformationMessage(`Found '${searchTerm}' at position ${indexFromStart}.`);
				} else {
					// Text not found at all
					vscode.window.showInformationMessage(`Text '${searchTerm}' not found.`);
				}
			}
		}
	});

	// Register the command to switch between loaded novels
	const switchNovelDisposable = vscode.commands.registerCommand('reader.switchNovel', async () => {
		if (novelFiles.length === 0) {
			vscode.window.showErrorMessage('No novels are currently loaded. Please select a novel first.');
			return;
		}

		// Create a list of novel file names for the user to choose from
		const novelNames = novelFiles.map(novel => {
			const pathParts = novel.path.split('/');
			return pathParts[pathParts.length - 1]; // Get the file name
		});

		// Show a quick pick menu for the user to select a novel
		const selectedNovelName = await vscode.window.showQuickPick(novelNames, {
			placeHolder: 'Select a novel to switch to'
		});

		if (selectedNovelName) {
			// Find the index of the selected novel
			const selectedIndex = novelNames.indexOf(selectedNovelName);
			if (selectedIndex !== -1) {
				// Save the current position before switching
				const previousNovel = getCurrentNovel();
				if (previousNovel) {
					context.workspaceState.update(`reader.position.${previousNovel.path}`, previousNovel.index);
				}
				
				// Switch to the selected novel
				currentNovelIndex = selectedIndex;
				
				// Try to load the last reading position for this file
				const currentNovel = getCurrentNovel();
				if (currentNovel) {
					const savedPosition = context.workspaceState.get<number>(`reader.position.${currentNovel.path}`);
					currentNovel.index = savedPosition !== undefined ? savedPosition : 0;
					
					// Display the content in the status bar
					updateStatusBar();
					statusBar.show();
					
					vscode.window.showInformationMessage(`Switched to: ${selectedNovelName}`);
				}
			}
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(selectNovelDisposable);
	context.subscriptions.push(nextPageDisposable);
	context.subscriptions.push(prevPageDisposable);
	context.subscriptions.push(searchNovelDisposable);
	context.subscriptions.push(switchNovelDisposable);
}

// Function to update the status bar with the current chunk of content
function updateStatusBar() {
	const currentNovel = getCurrentNovel();
	if (currentNovel) {
		const chunkSize = getChunkSize();
		const endIndex = Math.min(currentNovel.index + chunkSize, currentNovel.content.length);
		let contentChunk = currentNovel.content.substring(currentNovel.index, endIndex);
		
		// Get the file name to display in the status bar
		const pathParts = currentNovel.path.split('/');
		const fileName = pathParts[pathParts.length - 1];
		
		// Truncate the content to fit the status bar
		contentChunk = truncateTextForStatusBar(contentChunk.replace(/\s+/g, ' '));
		
		statusBar.text = `$(book) [${fileName}] ${contentChunk}`;
		statusBar.tooltip = 'Click to go to next page';
	}
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (statusBar) {
		statusBar.dispose();
	}
}
