// 'vscode' 模块包含了 VS Code 的扩展性 API
// 导入该模块并在你的代码中使用别名 vscode 来引用它
import * as vscode from 'vscode';
import * as iconv from 'iconv-lite';
import * as jschardet from 'jschardet';

// 用于表示小说文件的接口
interface NovelFile {
	path: string;
	content: string;
	index: number; // 当前阅读位置
}

// 用于存储小说内容和状态栏项目的全局变量
let novelFiles: NovelFile[] = []; // 用于存储多个小说文件的数组
let currentNovelIndex: number = -1; // 数组中当前选定的小说的索引
let statusBar: vscode.StatusBarItem;

// 用于将小说文件保存到工作区状态的辅助函数
function saveNovelFiles(context: vscode.ExtensionContext) {
	context.globalState.update('reader.novelFiles', novelFiles);
	context.globalState.update('reader.currentNovelIndex', currentNovelIndex);
}

// 用于获取当前选定的小说的辅助函数
function getCurrentNovel(): NovelFile | undefined {
	if (currentNovelIndex >= 0 && currentNovelIndex < novelFiles.length) {
		return novelFiles[currentNovelIndex];
	}
	return undefined;
}

// 用于从配置中获取块大小的辅助函数
function getChunkSize(): number {
	return vscode.workspace.getConfiguration('reader').get('chunkSize', 80);
}

// 帮助获取编码设置
function getReaderEncoding(): 'utf8' | 'gbk' | 'auto' {
	return vscode.workspace.getConfiguration('reader').get('encoding', 'utf8') as any;
}

// 根据编码设置解码缓冲区
function decodeBuffer(buf: Uint8Array, encodingSetting: 'utf8' | 'gbk' | 'auto'): string {
	try {
		if (encodingSetting === 'utf8') {
			return Buffer.from(buf).toString('utf8');
		}
		if (encodingSetting === 'gbk') {
			return iconv.decode(Buffer.from(buf), 'gbk');
		}
		// 自动检测
		const detected = jschardet.detect(Buffer.from(buf));
		const enc = (detected.encoding || '').toLowerCase();
		if (enc.includes('gb') || enc === 'gbk' || enc === 'gb2312' || enc === 'gb18030') {
			return iconv.decode(Buffer.from(buf), 'gbk');
		}
		// 回退到 utf8
		return Buffer.from(buf).toString('utf8');
	} catch (e) {
		// 出错时回退
		return Buffer.from(buf).toString('utf8');
	}
}

// 用于截断文本以适应状态栏的辅助函数
function truncateTextForStatusBar(text: string): string {
	// 使用一个固定的有效块大小，适用于大多数状态栏
	const effectiveChunkSize = 50;
	
	if (text.length <= effectiveChunkSize) {
		return text;
	}
	
	// 截断文本并添加省略号
	return text.substring(0, effectiveChunkSize - 3) + '...';
}

// 当您的扩展被激活时，将调用此方法
// 您的扩展在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {

	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在你的扩展被激活时执行一次
	console.log('恭喜，您的扩展“reader”现在已激活！');
	
	// 从工作区状态加载已保存的小说文件
	const savedNovelFiles = context.globalState.get<NovelFile[]>('reader.novelFiles');
	if (savedNovelFiles) {
		novelFiles = savedNovelFiles;
		// 加载当前小说的索引
		currentNovelIndex = context.globalState.get<number>('reader.currentNovelIndex', -1);
		// 加载每个文件的阅读位置
		for (const novel of novelFiles) {
			const savedPosition = context.globalState.get<number>(`reader.position.${novel.path}`);
			if (savedPosition !== undefined) {
				novel.index = savedPosition;
			}
		}
	}

	// 创建一个状态栏项目
	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBar.command = 'reader.nextPage'; // 设置点击状态栏的命令
	context.subscriptions.push(statusBar);

	// 该命令已在 package.json 文件中定义
	// 现在使用 registerCommand 提供命令的实现
	// commandId 参数必须与 package.json 中的 command 字段匹配
	const disposable = vscode.commands.registerCommand('reader.helloWorld', () => {
		// 您在此处放置的代码将在每次执行命令时执行
		// 向用户显示一个消息框
		vscode.window.showInformationMessage('Hello World from reader!');
	});

	// 注册选择小说文件的命令
	const selectNovelDisposable = vscode.commands.registerCommand('reader.selectNovel', async () => {
		// 打开文件对话框以选择 .txt 文件
		const options: vscode.OpenDialogOptions = {
			canSelectMany: true, // 允许选择多个文件
			openLabel: '选择小说',
			filters: {
				'Text files': ['txt']
			}
		};

		const fileUris = await vscode.window.showOpenDialog(options);
		if (fileUris && fileUris.length > 0) {
			// 处理每个选定的文件
			for (const fileUri of fileUris) {
				// 检查文件是否已加载
				const existingIndex = novelFiles.findIndex(novel => novel.path === fileUri.fsPath);
				if (existingIndex === -1) {
					// 读取所选文件的内容并支持编码
					const fileContent = await vscode.workspace.fs.readFile(fileUri);
					const content = decodeBuffer(fileContent, getReaderEncoding());
					
					// 创建一个新的 NovelFile 对象
					const newNovel: NovelFile = {
						path: fileUri.fsPath,
						content: content,
						index: 0 // 从头开始
					};
					
					// 将新小说添加到数组中
					novelFiles.push(newNovel);
					
					// 如果这是加载的第一个文件，则将其设置为当前小说
					if (currentNovelIndex === -1) {
						currentNovelIndex = 0;
					}
					
					vscode.window.showInformationMessage(`已加载文件: ${fileUri.fsPath}`);
				} else {
					vscode.window.showInformationMessage(`文件 ${fileUri.fsPath} 已加载。`);
				}
			}
			
			// 将小说文件保存到工作区状态
			saveNovelFiles(context);
			
			// 在状态栏中显示当前小说的内容
			if (currentNovelIndex !== -1) {
				updateStatusBar();
				statusBar.show();
			}
		}
	});

	// 注册下一页的命令
	const nextPageDisposable = vscode.commands.registerCommand('reader.nextPage', () => {
		const currentNovel = getCurrentNovel();
		if (currentNovel) {
			const chunkSize = getChunkSize();
			currentNovel.index += chunkSize;
			if (currentNovel.index >= currentNovel.content.length) {
				currentNovel.index = 0; // 回到开头
			}
			updateStatusBar();
			
			// 保存当前阅读位置
			context.globalState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
		}
	});

	// 注册上一页的命令
	const prevPageDisposable = vscode.commands.registerCommand('reader.prevPage', () => {
		const currentNovel = getCurrentNovel();
		if (currentNovel) {
			const chunkSize = getChunkSize();
			currentNovel.index -= chunkSize;
			if (currentNovel.index < 0) {
				// 回到末尾
				const totalPages = Math.ceil(currentNovel.content.length / chunkSize);
				currentNovel.index = (totalPages - 1) * chunkSize;
			}
			updateStatusBar();
			
			// 保存当前阅读位置
			context.globalState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
		}
	});

	// 注册在小说中搜索文本的命令
	const searchNovelDisposable = vscode.commands.registerCommand('reader.searchNovel', async () => {
		const currentNovel = getCurrentNovel();
		if (!currentNovel) {
			vscode.window.showErrorMessage('当前未加载任何小说。请先选择一本小说。');
			return;
		}

		// 询问用户要搜索的词条
		const searchTerm = await vscode.window.showInputBox({
			prompt: '输入要搜索的文本',
			placeHolder: '搜索文本...'
		});

		if (searchTerm) {
			// 执行搜索
			const index = currentNovel.content.indexOf(searchTerm, currentNovel.index + 1); // 从下一个字符开始搜索
			if (index !== -1) {
				// 找到文本，跳转到其位置
				currentNovel.index = index;
				updateStatusBar();
				
				// 保存当前阅读位置
				context.globalState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
				
				vscode.window.showInformationMessage(`在位置 ${index} 找到 '${searchTerm}'。`);
			} else {
				// 从当前位置未找到文本，从头开始搜索
				const indexFromStart = currentNovel.content.indexOf(searchTerm);
				if (indexFromStart !== -1) {
					currentNovel.index = indexFromStart;
					updateStatusBar();
					
					// 保存当前阅读位置
					context.globalState.update(`reader.position.${currentNovel.path}`, currentNovel.index);
					
					vscode.window.showInformationMessage(`在位置 ${indexFromStart} 找到 '${searchTerm}'。`);
				} else {
					// 完全找不到文本
					vscode.window.showInformationMessage(`未找到文本 '${searchTerm}'。`);
				}
			}
		}
	});

	// 注册在已加载的小说之间切换的命令
	const switchNovelDisposable = vscode.commands.registerCommand('reader.switchNovel', async () => {
		if (novelFiles.length === 0) {
			vscode.window.showErrorMessage('当前没有加载任何小说。请先选择一本小说。');
			return;
		}

		// 创建一个小说文件名列表供用户选择
		const novelNames = novelFiles.map(novel => {
			const pathParts = novel.path.split('/');
			return pathParts[pathParts.length - 1]; // 获取文件名
		});

		// 显示一个快速选择菜单供用户选择小说
		const selectedNovelName = await vscode.window.showQuickPick(novelNames, {
			placeHolder: '选择要切换到的小说'
		});

		if (selectedNovelName) {
			// 查找所选小说的索引
			const selectedIndex = novelNames.indexOf(selectedNovelName);
			if (selectedIndex !== -1) {
				// 切换前保存当前位置
				const previousNovel = getCurrentNovel();
				if (previousNovel) {
					context.globalState.update(`reader.position.${previousNovel.path}`, previousNovel.index);
				}
				
				// 切换到所选小说
				currentNovelIndex = selectedIndex;
				
				// 尝试加载此文件的上次阅读位置
				const currentNovel = getCurrentNovel();
				if (currentNovel) {
					const savedPosition = context.globalState.get<number>(`reader.position.${currentNovel.path}`);
					currentNovel.index = savedPosition !== undefined ? savedPosition : 0;
					
					// 在状态栏中显示内容
					updateStatusBar();
					statusBar.show();
					
					vscode.window.showInformationMessage(`已切换到: ${selectedNovelName}`);
				}
				
				// 保存小说文件状态
				saveNovelFiles(context);
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

// 使用当前内容块更新状态栏的函数
function updateStatusBar() {
	const currentNovel = getCurrentNovel();
	if (currentNovel) {
		const chunkSize = getChunkSize();
		const endIndex = Math.min(currentNovel.index + chunkSize, currentNovel.content.length);
		let contentChunk = currentNovel.content.substring(currentNovel.index, endIndex);
		
		// 获取要在状态栏中显示的文件名（仅前5个字符）
		const pathParts = currentNovel.path.split('/');
		const fullFileName = pathParts[pathParts.length - 1];
		const fileName = fullFileName.length > 5 ? fullFileName.substring(0, 5) : fullFileName;
		
		// 截断内容以适应状态栏
		contentChunk = truncateTextForStatusBar(contentChunk.replace(/\s+/g, ' '));
		
		statusBar.text = `$(book) [${fileName}] ${contentChunk}`;
		statusBar.tooltip = '点击翻到下一页';
	}
}

// 当您的扩展被停用时，此方法将被调用
export function deactivate(context: vscode.ExtensionContext) {
	// 在停用前保存小说文件和当前索引
	saveNovelFiles(context);
	
	if (statusBar) {
		statusBar.dispose();
	}
}
