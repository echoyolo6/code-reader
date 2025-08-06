# Code Reader - VS Code 小说阅读器

一个在 VS Code 状态栏中阅读小说的插件，非常隐蔽，不容易被领导发现。

## 特性

- 在 VS Code 状态栏中显示小说内容，极其隐蔽
- 支持 `.txt` 格式的小说文件
- 通过点击状态栏或快捷键翻页
  - 下一页: `Cmd+Shift+]` (Mac) / `Ctrl+Shift+]` (Windows/Linux)
  - 上一页: `Cmd+Shift+[` (Mac) / `Ctrl+Shift+[` (Windows/Linux)
- 自动保存阅读进度，下次打开时可以继续阅读
- 支持搜索文本并跳转到对应位置
- 支持加载和管理多个小说文件
- 可配置的显示字符数

## 使用方法

1. 按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows/Linux) 打开命令面板
2. 输入 `Select Novel` 并执行命令，选择一个 `.txt` 格式的小说文件
3. 小说内容将显示在 VS Code 状态栏中
4. 点击状态栏或使用快捷键翻页
5. 使用 `Search Novel` 命令搜索文本并跳转
6. 使用 `Switch Novel` 命令在多个加载的小说文件之间切换

## 配置

* `reader.chunkSize`: 设置状态栏中显示的字符数 (默认: 50)

## 发布说明

### 1.0.0

初始版本发布
- 基本的小说阅读功能
- 状态栏显示
- 翻页功能
- 进度保存
- 搜索功能
- 多文件管理