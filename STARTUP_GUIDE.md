# AI任务集市 - 启动指南

## 问题诊断结果

经过诊断测试，发现：
- ✓ 后端API服务器运行正常 (http://localhost:3000)
- ✓ 数据库中有5个已发布的任务
- ✗ 前端服务器可能未正常启动或配置有问题

## 手动启动步骤

### 1. 启动后端服务器（端口3000）

打开终端，运行：

```bash
cd d:\aishop
npm run dev:backend
```

应该看到：
```
Server running on http://localhost:3000
数据库连接成功
```

### 2. 启动前端服务器（端口5173）

打开另一个终端，运行：

```bash
cd d:\aishop
npm run dev:frontend
```

应该看到：
```
VITE v4.5.14  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 3. 访问应用

在浏览器中打开：
- 前端：http://localhost:5173
- 后端API：http://localhost:3000

## 测试账户

- **管理员**：admin / admin123
- **技术专家**：expert / expert123
- **普通用户**：user / user123

## 数据库状态

数据库中已有：
- 5个已发布的任务（可被所有用户浏览）
- 1个待审核的任务（需管理员/专家审核）
- 4个用户账户

## 常见问题

### 1. 前端显示"暂无任务"
- 检查浏览器控制台（F12）是否有错误
- 检查Network标签页，看API请求是否成功
- 确认已登录（右上角应显示用户名）

### 2. 登录失败
- 确认使用的是测试账户
- 检查后端服务器是否正常运行

### 3. API请求失败
- 检查浏览器控制台的网络请求
- 确认后端服务器在3000端口运行
- 检查CORS设置

## 快捷启动脚本

如果以上步骤太麻烦，可以：
1. 双击运行 `start-all.bat` 启动所有服务
2. 或分别运行：
   - `start-server.cmd` 启动后端
   - 在另一个窗口运行 `npm run dev:frontend` 启动前端
