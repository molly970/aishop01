# AI任务集市 - 调试指南

## 问题：任务列表显示为空

### 快速诊断步骤

#### 1. 检查后端是否运行

打开浏览器访问：http://localhost:3000/api/health

应该看到类似：`{"status":"ok","message":"Server is running"}`

如果不行，启动后端：
```bash
cd d:\aishop
npm run dev:backend
```

#### 2. 检查前端是否运行

打开浏览器访问：http://localhost:5173

如果不行，启动前端：
```bash
cd d:\aishop
npm run dev:frontend
```

#### 3. 使用API测试页面

在浏览器打开：http://localhost:5173/api-test.html

按照页面上的步骤测试：
- 点击"测试健康检查"
- 点击"使用user/user123登录"
- 点击"获取任务列表"

#### 4. 使用内置调试页面

登录后访问：http://localhost:5173/debug

#### 5. 查看浏览器控制台

按F12打开开发者工具，切换到Console标签，查看是否有错误。

## 测试账户

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 主管理员 | admin | admin123 |
| 技术专家 | expert | expert123 |
| 普通用户 | user | user123 |

## 预期行为

### 普通用户
- 登录后首页应能看到7个已发布的任务
- 任务状态为"published"
- 可以申领任务

### 管理员/技术专家
- 可以看到所有状态的任务（包括待审核的）
- 可以审核任务
- 可以分配任务

## 后端调试

后端服务器运行在 http://localhost:3000

### 查看后端日志

后端控制台会显示：
```
=== 获取任务列表 ===
用户角色: user
查询参数 - status: undefined type: undefined search: undefined
普通用户，只查看已发布任务
执行SQL: SELECT * FROM tasks WHERE 1=1 AND status = "published" ORDER BY created_at DESC
...
```

### 数据库文件位置

`d:\aishop\data\database.sqlite`

## 前端调试

### 检查LocalStorage

在浏览器控制台执行：
```javascript
localStorage.getItem('token')
localStorage.getItem('user')
```

### 检查API请求

在Network标签下，查看：
- 请求URL是否正确
- 请求头是否有Authorization
- 响应内容是什么

## 常见问题

### Q1: 前端连接后端失败

**检查：**
1. 后端是否运行在3000端口
2. CORS是否正确配置（已配置）
3. 防火墙是否阻止

### Q2: Token无效

**解决：** 重新登录，清除LocalStorage

### Q3: 数据库没有任务

**解决：** 删除 `d:\aishop\data\database.sqlite`，重启后端，会自动创建测试数据

## 管理员功能

1. 审核任务：登录 admin/admin123，访问 /review
2. 查看所有任务：访问首页，可以看到所有状态
3. 审批记录：在任务详情页可以看到审批历史
