# Inkdown

Inkdown 是一个可打包为 Windows 安装程序的桌面 Markdown 编辑器基础版，目标是做出接近 Typora 的沉浸式单栏编辑体验。

## 当前能力

- 单栏所见即所得编辑体验
- 编辑器 / 源码 / 预览三种视图
- 标题、加粗、斜体、下划线、删除线、代码块、引用
- 高亮、上标、下标
- 无序列表、有序列表、任务列表
- 链接、图片、表格插入
- YAML Front Matter、脚注、GitHub 风格 Callout
- 拖拽和粘贴图片，已保存文档时自动落到相对路径资源目录
- Markdown 打开、保存、另存为
- HTML 导出
- PDF 导出
- Mermaid 图表与数学公式预览
- 查找替换
- 文档大纲、字数统计、未保存状态提示
- 主题与排版偏好设置
- `electron-builder` 的 Windows `nsis` 安装包配置

## 开发

```bash
npm install
npm run dev
```

如果你是在 Windows PowerShell 下做 Electron 调试，不要直接写 Unix 风格的环境变量前缀命令（例如 `FOO=bar command`），PowerShell 会把 `=true`、`=*` 之类内容当成独立命令而报错。仓库里已经提供了可直接使用的调试脚本：

```bash
npm run dev:debug
```

它会安全地注入这些调试变量：

- `ELECTRON_ENABLE_LOGGING=true`
- `ELECTRON_ENABLE_STACK_DUMPING=true`
- `DEBUG=*`
- `NODE_OPTIONS=--trace-warnings`

## 打包

```bash
npm run build
```

Windows 安装包使用：

```bash
npm run package:win
```

产物默认输出到 `release/` 目录。当前仓库是在 Linux/WSL 环境初始化的，Windows 安装包能否实际生成还取决于本机是否具备 `wine` 等交叉打包依赖。
