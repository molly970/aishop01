# AI任务集市系统 PRD 文档

## 一、项目概述

### 1.1 项目背景
企业内部推行AI任务集市系统，用于任务提交、专家审核评级、任务发布、申领、分配、结果提报、审批等全流程管理。

### 1.2 项目目标
- 实现任务从发布到完成的完整闭环管理
- 支持多角色权限控制（主管理员、普通管理员、技术专家、普通用户）
- 提供任务审核评级机制（应用思维、产品思维、工程思维三维度）
- 支持1GB以内的文件上传
- 主管理员可在后台动态调整和分配所有角色权限

### 1.3 技术栈
**前端：**
- React 18 + TypeScript
- Vite (开发服务器)
- TailwindCSS 3 (样式框架)
- Zustand (状态管理)
- Lucide React (图标库)
- React Router (路由)

**后端：**
- Express + TypeScript
- SQLite (数据库)
- JWT (身份认证)
- Multer (文件上传)

**配置：**
- 后端端口：3003
- 前端端口：5174
- 代理配置：/api 和 /uploads 转发至后端

---

## 二、用户角色与权限

### 2.1 角色定义

| 角色 | 角色标识 | 权限说明 |
|------|---------|---------|
| 主管理员 | main_admin | 拥有系统全部权限，可进行所有操作，包括角色权限管理和审批 |
| 普通管理员 | admin | 查看任务审核、任务分配、结果审核（最多3人） |
| 技术专家 | expert | 查看任务审核、结果审核，提供专业意见（无审批操作权限） |
| 普通用户 | user | 提交任务、申领任务、提交结果 |

### 2.2 权限矩阵

**说明：**
- ✅ 表示拥有该权限
- ❌ 表示不拥有该权限
- "查看"：可查看任务审核/分配/结果审核的列表和详情
- "操作"：可执行审核通过/拒绝、分配任务等操作

| 功能模块 | 主管理员 | 普通管理员 | 技术专家 | 普通用户 |
|---------|---------|-----------|---------|---------|
| **任务审核** | | | | |
| - 查看 | ✅ | ✅ | ✅ | ❌ |
| - 操作 | ✅ | ❌ | ❌ | ❌ |
| **任务分配** | | | | |
| - 查看 | ✅ | ✅ | ✅ | ❌ |
| - 操作 | ✅ | ❌ | ❌ | ❌ |
| **结果审核** | | | | |
| - 查看 | ✅ | ✅ | ✅ | ❌ |
| - 操作 | ✅ | ❌ | ❌ | ❌ |
| 提交任务 | ✅ | ✅ | ✅ | ✅ |
| 申领任务 | ✅ | ✅ | ✅ | ✅ |
| 提交结果 | ✅ | ✅ | ✅ | ✅ |
| **角色权限管理** | ✅ | ❌ | ❌ | ❌ |

---

### 2.3 角色权限管理

**功能描述：**
- 主管理员可在后台管理界面调整所有用户角色的权限
- 支持自定义各角色的查看和操作权限
- 权限变更实时生效，可查询权限变更历史
- 提供权限默认配置重置功能

**管理流程：**
1. 主管理员进入"系统管理-角色权限管理"页面
2. 查看各角色当前权限配置
3. 点击"编辑权限"修改特定角色的权限设置
4. 保存权限配置，系统记录变更日志
5. 权限变更实时生效

**权限可配置项：**
- 任务审核：查看、操作
- 任务分配：查看、操作
- 结果审核：查看、操作
- 提交任务：是/否
- 申领任务：是/否
- 提交结果：是/否
- 角色权限管理：是/否（仅主管理员可配置）

---

## 三、功能模块详情

### 3.1 用户注册与登录

**功能描述：**
- 用户注册必须使用花名作为用户名
- 登录使用用户名（花名）+ 密码
- 支持JWT Token认证
- 登录状态持久化至localStorage

**业务流程：**
1. 用户访问登录页
2. 输入花名和密码
3. 系统验证身份
4. 验证通过返回JWT Token
5. 前端存储Token并跳转首页

**数据表：** users
- id: 用户ID
- username: 用户名（花名）
- password: 密码（加密存储）
- name: 姓名
- role: 角色
- created_at: 创建时间

### 3.2 任务提交

**功能描述：**
- 普通用户可提交AI任务需求
- 任务编号系统自动生成
- 支持悬赏澳维豆或悬赏物
- 支持1GB以内文件上传

**提交流程：**
1. 用户进入"提交任务"页面
2. 填写任务信息：
   - 任务标题（必填）
   - 任务描述（必填）
   - 悬赏类型：澳维豆/悬赏物/两者都有
   - 悬赏数量（澳维豆）
   - 悬赏物描述
   - 难度等级：简单/中等/复杂
   - 期望完成时间
   - 优先级：低/中/高
3. 上传相关文件（可选）
4. 提交审核

**业务规则：**
- 任务状态初始为"pending"（待审核）
- 任务编号格式：AI-YYYYMMDD-N
- 提交后进入任务审核流程

### 3.3 任务审核

**功能描述：**
- 主管理员可审核待审核任务
- 技术专家可查看任务并提供专业意见
- 支持三维度评级（应用思维、产品思维、工程思维）
- 每个维度最多3星，满分3星
- 审核结果：通过/拒绝
- 通过的任务自动生成任务编号

**审核流程：**
1. 审核人员进入"审核管理-任务审核"
2. 查看待审核任务列表
3. 点击任务查看详情（技术专家可查看并提供意见）
4. 主管理员对任务进行三维度评级
5. 填写审核意见（可选）
6. 提交审核结果

**审核结果处理：**
- **审核通过：**
  - 任务状态变为"published"（已发布）
  - 任务显示在首页供用户申领
  - 生成任务编号
- **审核拒绝：**
  - 任务状态变为"cancelled"（已取消）
  - 用户可查看被拒绝的任务（显示"未通过，请联系管理员"）

**数据表：** tasks
- id: 任务ID
- task_no: 任务编号
- title: 任务标题
- description: 任务描述
- reward_type: 悬赏类型（points/item/both）
- reward: 悬赏数量
- reward_item: 悬赏物描述
- difficulty: 难度等级
- expected_deadline: 期望完成时间
- priority: 优先级
- rating: 总评分
- ratings: 各维度评分（JSON格式）
- status: 状态（pending/published/cancelled）
- submitter_id: 提交者ID
- submitter_name: 提交者姓名
- created_at: 创建时间

**数据表：** task_approvals
- id: 审批ID
- task_id: 任务ID
- task_no: 任务编号
- approver_id: 审批人ID
- approver_name: 审批人姓名
- approver_role: 审批人角色
- action: 操作类型（approve/reject）
- comment: 审批意见
- ratings: 各维度评分
- created_at: 审批时间

### 3.4 任务发布与展示

**功能描述：**
- 审核通过的任务自动发布到首页
- 首页显示所有已发布任务
- 任务卡片显示三维度评级

**首页任务展示：**
- 任务标题、描述
- 悬赏信息（澳维豆/悬赏物）
- 难度等级
- 截止日期
- 任务发布者
- **三维度评级展示：**
  - 应用思维：⭐⭐⭐（最多3星）
  - 产品思维：⭐⭐⭐（最多3星）
  - 工程思维：⭐⭐⭐（最多3星）

### 3.5 任务申领

**功能描述：**
- 已发布任务显示在首页供所有用户查看
- 用户可点击"申领任务"按钮申请申领
- 申领后任务仍显示在首页供其他人查看
- 已申领用户看到"已申领"状态
- 不可重复申领同一任务

**申领流程：**
1. 用户在首页浏览已发布任务
2. 点击"申领任务"按钮
3. 任务状态变为"claimed"（待指派）
4. 其他用户仍可看到任务
5. 申领用户看到"已申领"状态

**数据表：** claims
- id: 申领ID
- task_id: 任务ID
- user_id: 申领用户ID
- user_name: 申领用户姓名
- status: 状态（pending/assigned）
- claimed_at: 申领时间

### 3.6 任务分配（申领审核）

**功能描述：**
- 主管理员可在"任务申领审核"板块查看申领情况
- 技术专家可查看申领情况但无分配权限
- 支持将任务分配给申领用户
- 任务一旦分配，从首页隐藏（其他板块继续保留）
- 被分配用户可进入结果提交界面

**分配流程：**
1. 主管理员进入"审核管理-任务申领审核"
2. 查看待指派任务列表
3. 查看每个任务的申领人员
4. 点击"分配给他"将任务分配给指定用户
5. 任务状态变为"assigned"（已分配）
6. 任务从首页隐藏
7. 被分配用户收到通知

### 3.7 结果提交

**功能描述：**
- 被分配任务的用户进入"完成结果提交"页面
- 显示待自己提交的任务列表
- 支持填写任务结果并提交
- 不通过可重新填写一次

**提交内容：**
- 使用说明（必填）
- 使用的AI工具（必填）
- 核心提示词（必填）
- 成果文件（支持PDF、DOC、DOCX、XLS、XLSX、PPT、PPTX）
- 相关截图（支持JPG、PNG、GIF）
- 承诺声明（必填）

**数据表：** submissions
- id: 提交ID
- task_id: 任务ID
- task_no: 任务编号
- submitter_id: 提交者ID
- submitter_name: 提交者姓名
- description: 描述
- ai_tool: AI工具
- prompt: 提示词
- usage_guide: 使用说明
- status: 状态（pending/approved/rejected）
- review_comment: 审核意见
- rating: 评分
- ratings: 各维度评分
- created_at: 创建时间
- reviewed_at: 审核时间
- reviewed_by: 审核人ID

**数据表：** files
- id: 文件ID
- submission_id: 提交ID
- task_id: 任务ID
- file_type: 文件类型（result/screenshot）
- file_name: 文件名
- file_path: 文件路径
- file_size: 文件大小
- mime_type: MIME类型
- uploaded_by: 上传者ID

### 3.8 结果审核

**功能描述：**
- 主管理员可在"结果审核"板块查看待审核结果并进行审核
- 技术专家可查看待审核结果并提供专业意见（无审核操作权限）
- 支持三维度评级
- 审核结果：通过/拒绝

**审核结果处理：**
- **审核通过：**
  - 结果状态变为"approved"
  - 任务状态变为"completed"
  - 所有记录内容保留
  - 通知提交者
- **审核拒绝：**
  - 结果状态变为"rejected"
  - 提交者还有一次重新填写的机会
  - 通知提交者修改后重新提交

---

## 四、审核管理模块

### 4.1 模块结构

审核管理包含三个子板块：

1. **任务审核**
   - 待审核任务
   - 已审核任务

2. **任务申领审核**
   - 待指派任务（显示申领人员）
   - 任务分配功能（仅主管理员可见）

3. **结果审核**
   - 待审核结果
   - 已审核结果

### 4.2 任务审核详细流程

**待审核任务列表：**
- 显示所有status为"pending"的任务
- 卡片展示：状态标签、难度等级、任务编号、标题、描述、悬赏信息、提交者、创建时间
- 支持点击查看详情
- 主管理员可见审核操作按钮，技术专家仅可查看

**已审核任务列表：**
- 显示所有status为"published"或"cancelled"的任务
- 卡片展示审核结果标签（已通过/已拒绝）
- 显示审核评分和审核意见

### 4.3 结果审核详细流程

**待审核结果列表：**
- 显示所有提交的待审核结果
- 卡片展示：任务标题、任务编号、提交者、提交时间
- 支持点击查看详情
- 主管理员可见审核操作按钮，技术专家仅可查看

**已审核结果列表：**
- 显示所有已审核结果（approved/rejected）
- 卡片展示审核结果标签
- 显示审核评分和审核意见

---

## 五、API接口文档

### 5.1 认证接口

**POST /api/auth/login**
```
请求体：{ username, password }
响应：{ token, user }
```

**POST /api/auth/register**
```
请求体：{ username, password, name }
响应：{ token, user }
```

### 5.2 任务接口

**GET /api/tasks**
```
说明：获取任务列表（首页展示用）
参数：status, search
返回：任务数组
```

**GET /api/tasks/pending**
```
说明：获取待审核任务
权限：主管理员、普通管理员、技术专家
返回：任务数组
```

**GET /api/tasks/reviewed**
```
说明：获取已审核任务
权限：主管理员、普通管理员、技术专家
返回：任务数组（published/cancelled）
```

**GET /api/tasks/claims**
```
说明：获取待指派任务及申领记录
权限：主管理员、普通管理员、技术专家
返回：任务数组（含claims字段）
```

**POST /api/tasks**
```
说明：提交新任务
权限：登录用户
请求体：任务信息
返回：任务对象
```

**PUT /api/tasks/:id/review**
```
说明：审核任务
权限：主管理员
请求体：{ approved, comment, ratings }
返回：{ message }
```

**PUT /api/tasks/:id/assign**
```
说明：分配任务
权限：主管理员
请求体：{ claimId }
返回：{ message }
```

**POST /api/tasks/:id/claim**
```
说明：申领任务
权限：登录用户
返回：{ message }
```

### 5.3 结果提交接口

**GET /api/submissions**
```
说明：获取所有提交记录
权限：主管理员、普通管理员、技术专家
返回：提交数组（含任务标题和编号）
```

**POST /api/submissions**
```
说明：提交任务结果
权限：被分配用户
请求体：formData（包含文件和字段）
返回：{ id, message }
```

**PUT /api/submissions/:id/review**
```
说明：审核结果
权限：主管理员
请求体：{ approved, review_comment, ratings }
返回：{ message }
```

### 5.4 角色权限管理接口

**GET /api/roles/permissions**
```
说明：获取所有角色的权限配置
权限：主管理员
返回：{ roles: [{ role, permissions }] }
```

**GET /api/roles/:role/permissions**
```
说明：获取特定角色的权限配置
权限：主管理员
返回：{ role, permissions }
```

**PUT /api/roles/:role/permissions**
```
说明：更新特定角色的权限配置
权限：主管理员
请求体：{
  permissions: {
    task_review_view, task_review_edit,
    task_assign_view, task_assign_edit,
    result_review_view, result_review_edit,
    submit_task, claim_task, submit_result,
    manage_permissions
  }
}
返回：{ message, role, permissions }
```

**POST /api/roles/reset**
```
说明：重置所有角色权限为默认配置
权限：主管理员
请求体：{}
返回：{ message }
```

**GET /api/permissions/logs**
```
说明：获取权限变更历史日志
权限：主管理员
参数：page, limit
返回：{ logs: [{ id, admin_id, admin_name, role, old_permissions, new_permissions, created_at }] }
```

---

## 六、数据库表结构

### 6.1 users（用户表）
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 6.2 tasks（任务表）
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  task_no TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,
  reward REAL,
  reward_type TEXT,
  reward_item TEXT,
  difficulty TEXT,
  expected_deadline TEXT,
  priority TEXT,
  rating INTEGER DEFAULT 0,
  ratings TEXT,
  status TEXT DEFAULT 'pending',
  submitter_id TEXT,
  submitter_name TEXT,
  assignee_id TEXT,
  assignee_name TEXT,
  review_comment TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### 6.3 task_approvals（任务审批表）
```sql
CREATE TABLE task_approvals (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  task_no TEXT,
  approver_id TEXT,
  approver_name TEXT,
  approver_role TEXT,
  action TEXT,
  old_status TEXT,
  new_status TEXT,
  comment TEXT,
  ratings TEXT,
  created_at TEXT
);
```

### 6.4 claims（申领表）
```sql
CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  user_id TEXT,
  user_name TEXT,
  status TEXT DEFAULT 'pending',
  claimed_at TEXT
);
```

### 6.5 submissions（结果提交表）
```sql
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  task_no TEXT,
  submitter_id TEXT,
  submitter_name TEXT,
  description TEXT,
  ai_tool TEXT,
  prompt TEXT,
  usage_guide TEXT,
  commitment INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  review_comment TEXT,
  rating INTEGER,
  ratings TEXT,
  created_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT
);
```

### 6.6 files（文件表）
```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  submission_id TEXT,
  task_id TEXT,
  file_type TEXT,
  file_name TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT
);
```

### 6.7 notifications（通知表）
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  task_id TEXT,
  type TEXT,
  title TEXT,
  content TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);
```

### 6.8 task_tracking（任务全流程跟踪表）
```sql
CREATE TABLE task_tracking (
  id TEXT PRIMARY KEY,
  tracking_no TEXT UNIQUE,
  task_id TEXT NOT NULL,
  task_no TEXT,
  -- 任务提报信息
  submitter_id TEXT,
  submitter_name TEXT,
  submit_time TEXT,
  -- 任务审核信息
  task_reviewer_id TEXT,
  task_reviewer_name TEXT,
  task_review_time TEXT,
  task_review_result TEXT,
  task_ratings_application INTEGER,
  task_ratings_product INTEGER,
  task_ratings_engineering INTEGER,
  task_review_comment TEXT,
  -- 任务申领信息
  claimant_id TEXT,
  claimant_name TEXT,
  claim_time TEXT,
  -- 任务分配信息
  assigner_id TEXT,
  assigner_name TEXT,
  assign_time TEXT,
  assignee_id TEXT,
  assignee_name TEXT,
  -- 结果提交信息
  result_submitter_id TEXT,
  result_submitter_name TEXT,
  result_submit_time TEXT,
  result_description TEXT,
  result_ai_tool TEXT,
  result_prompt TEXT,
  result_usage_guide TEXT,
  -- 结果审核信息
  result_reviewer_id TEXT,
  result_reviewer_name TEXT,
  result_review_time TEXT,
  result_review_result TEXT,
  result_ratings_application INTEGER,
  result_ratings_product INTEGER,
  result_ratings_engineering INTEGER,
  result_review_comment TEXT,
  -- 任务最终状态
  final_status TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**字段说明：**

| 字段组 | 字段名 | 说明 | 关联阶段 |
|-------|--------|------|
| 基础信息 | id | 跟踪记录ID | - |
|  | tracking_no | 跟踪编号（自动生成） | - |
|  | task_id | 任务ID | - |
|  | task_no | 任务编号 | - |
| 任务提报 | submitter_id | 提报人ID | 任务提报 |
|  | submitter_name | 提报人花名 | 任务提报 |
|  | submit_time | 提报时间 | 任务提报 |
| 任务审核 | task_reviewer_id | 审核人ID | 任务审核 |
|  | task_reviewer_name | 审核人花名 | 任务审核 |
|  | task_review_time | 审核时间 | 任务审核 |
|  | task_review_result | 审核结果（approved/rejected） | 任务审核 |
|  | task_ratings_application | 应用思维评分 | 任务审核 |
|  | task_ratings_product | 产品思维评分 | 任务审核 |
|  | task_ratings_engineering | 工程思维评分 | 任务审核 |
|  | task_review_comment | 审核意见 | 任务审核 |
| 任务申领 | claimant_id | 申领人ID | 任务申领 |
|  | claimant_name | 申领人花名 | 任务申领 |
|  | claim_time | 申领时间 | 任务申领 |
| 任务分配 | assigner_id | 分配人ID | 任务分配 |
|  | assigner_name | 分配人花名 | 任务分配 |
|  | assign_time | 分配时间 | 任务分配 |
|  | assignee_id | 被分配人ID | 任务分配 |
|  | assignee_name | 被分配人花名 | 任务分配 |
| 结果提交 | result_submitter_id | 结果提交人ID | 结果提交 |
|  | result_submitter_name | 结果提交人花名 | 结果提交 |
|  | result_submit_time | 提交时间 | 结果提交 |
|  | result_description | 结果描述 | 结果提交 |
|  | result_ai_tool | 使用的AI工具 | 结果提交 |
|  | result_prompt | 核心提示词 | 结果提交 |
|  | result_usage_guide | 使用说明 | 结果提交 |
| 结果审核 | result_reviewer_id | 审核人ID | 结果审核 |
|  | result_reviewer_name | 审核人花名 | 结果审核 |
|  | result_review_time | 审核时间 | 结果审核 |
|  | result_review_result | 审核结果（approved/rejected） | 结果审核 |
|  | result_ratings_application | 应用思维评分 | 结果审核 |
|  | result_ratings_product | 产品思维评分 | 结果审核 |
|  | result_ratings_engineering | 工程思维评分 | 结果审核 |
|  | result_review_comment | 审核意见 | 结果审核 |
| 状态 | final_status | 最终状态 | - |
|  | created_at | 创建时间 | - |
|  | updated_at | 更新时间 | - |

### 6.9 admin_logs（操作日志表）
```sql
CREATE TABLE admin_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  action_type TEXT,
  action_detail TEXT,
  target_id TEXT,
  target_type TEXT,
  created_at TEXT
);
```

### 6.10 role_permissions（角色权限表）
```sql
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role TEXT UNIQUE NOT NULL,
  -- 任务审核权限
  task_review_view INTEGER DEFAULT 0,
  task_review_edit INTEGER DEFAULT 0,
  -- 任务分配权限
  task_assign_view INTEGER DEFAULT 0,
  task_assign_edit INTEGER DEFAULT 0,
  -- 结果审核权限
  result_review_view INTEGER DEFAULT 0,
  result_review_edit INTEGER DEFAULT 0,
  -- 基础功能权限
  submit_task INTEGER DEFAULT 1,
  claim_task INTEGER DEFAULT 1,
  submit_result INTEGER DEFAULT 1,
  -- 权限管理权限
  manage_permissions INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

### 6.11 permission_change_logs（权限变更日志表）
```sql
CREATE TABLE permission_change_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_name TEXT,
  role TEXT,
  old_permissions TEXT,
  new_permissions TEXT,
  created_at TEXT
);
```

---

## 七、核心业务流程图

### 7.1 任务全生命周期

```
用户提交任务
    ↓
任务审核（主管理员）
    ↓
┌─────────────────┐
↓                 ↓
通过              拒绝
↓                 ↓
生成任务编号      任务状态变为cancelled
↓                 用户查看"未通过"
任务状态变为published
↓
显示在首页供申领
    ↓
用户点击"申领任务"
    ↓
任务状态变为claimed（待指派）
    ↓
任务申领审核（主管理员）
    ↓
点击"分配给他"
    ↓
任务状态变为assigned
    ↓
任务从首页隐藏
    ↓
被分配用户提交结果
    ↓
结果审核（主管理员）
    ↓
┌─────────────────┐
↓                 ↓
通过              拒绝
↓                 ↓
任务完成          用户重新提交
所有记录保留      （一次机会）
```

### 7.2 申领与分配流程

```
已发布任务显示在首页
    ↓
用户A点击"申领任务"
    ↓
系统记录申领信息（status=pending）
    ↓
用户A看到"已申领"按钮（禁用）
    ↓
其他用户仍可看到任务
    ↓
主管理员审核申领
    ↓
点击"分配给他"
    ↓
申领状态变为assigned
任务状态变为assigned
    ↓
任务从首页隐藏
assignee_id设为用户A
    ↓
用户A进入"完成结果提交"
    ↓
提交任务结果
```

### 7.3 角色权限管理流程

```
主管理员登录系统
    ↓
进入"系统管理-角色权限管理"
    ↓
查看所有角色当前权限配置
    ↓
选择要修改的角色
    ↓
点击"编辑权限"
    ↓
调整各项权限开关
    ↓
确认修改并保存
    ↓
系统记录权限变更日志
    ↓
权限实时生效
    ↓
（可选）查看权限变更历史
```

---

## 八、业务规则汇总

### 8.1 任务规则
1. 任务编号格式：AI-YYYYMMDD-N（自动生成）
2. 任务状态：pending → published/cancelled → claimed → assigned → completed
3. 已发布任务可被多人申领，但只能分配给一人
4. 任务一旦分配，立即从首页隐藏
5. 任务三维度评级：应用思维、产品思维、工程思维，各3星满

### 8.2 审核规则
1. 任务审核：支持三维度评级，需填写审核意见（仅主管理员可操作）
2. 技术专家可查看任务和结果，提供专业意见但无审批权限
3. 任务拒绝后，用户可联系管理员
4. 结果审核不通过，用户有一次重新提交机会

### 8.3 申领规则
1. 已发布任务可被所有用户申领
2. 一个用户只能申领一次同一任务
3. 申领后任务仍显示在首页
4. 已申领用户看到"已申领"状态

### 8.4 文件规则
1. 单个文件大小限制：1GB
2. 支持格式：PDF、DOC、DOCX、XLS、XLSX、PPT、PPTX、图片（JPG、PNG、GIF）

### 8.5 角色权限管理规则
1. 只有主管理员可访问角色权限管理功能
2. 角色权限配置实时生效，无需重启系统
3. 所有权限变更操作会被记录到日志
4. 主管理员可随时将权限重置为默认配置
5. manage_permissions权限只能由主管理员配置，其他角色无法获得此权限

---

## 九、状态标签说明

### 9.1 任务状态标签颜色
| 状态 | 颜色 | 说明 |
|------|------|------|
| pending | 黄色 | 待审核 |
| published | 绿色 | 已发布/已通过 |
| claimed | 蓝色 | 待指派 |
| assigned | 绿色 | 已分配 |
| completed | 绿色 | 已完成 |
| cancelled | 红色 | 已拒绝/已取消 |

### 9.2 难度等级标签颜色
| 难度 | 颜色 |
|------|------|
| simple | 绿色 |
| medium | 黄色 |
| complex | 红色 |

---

## 十、关键文件路径

### 10.1 前端核心文件
- 入口文件：`src/main.tsx`
- 路由配置：`src/App.tsx`
- API接口：`src/api/api.ts`
- 认证状态：`src/store/authStore.ts`
- 全局样式：`src/index.css`

### 10.2 页面组件
- 首页：`src/pages/Home.tsx`
- 登录：`src/pages/Login.tsx`
- 任务提交：`src/pages/SubmitTask.tsx`
- 审核管理：`src/pages/Review.tsx`
- 结果提交列表：`src/pages/ResultSubmitList.tsx`
- 结果提交：`src/pages/SubmitResult.tsx`
- 我的任务：`src/pages/MyTasks.tsx`
- 任务详情：`src/pages/TaskDetail.tsx`
- 通知：`src/pages/Notifications.tsx`
- 角色权限管理：`src/pages/PermissionManagement.tsx`
- 导航栏：`src/components/Navbar.tsx`

### 10.3 后端核心文件
- 服务器入口：`api/server.ts`
- 数据库配置：`api/database.ts`
- 任务路由：`api/routes/tasks.ts`
- 结果路由：`api/routes/submissions.ts`
- 角色权限路由：`api/routes/permissions.ts`
- 认证中间件：`api/routes/auth.ts`

### 10.4 配置文件
- 环境变量：`.env`
- 前端配置：`vite.config.ts`
- 包管理：`package.json`

---

## 十一、测试账号

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 主管理员 | admin | admin123 | 系统管理员，拥有全部权限 |
| 技术专家 | expert | expert123 | 仅查看权限，无审批操作权限 |
| 普通用户 | testuser | test123 | 测试用户 |

---

## 十二、注意事项

1. **端口配置**：后端运行在3003端口，前端运行在5174端口
2. **代理配置**：前端通过代理访问后端API，配置在vite.config.ts
3. **数据库**：使用SQLite，数据库文件位于data/database.sqlite
4. **文件上传**：上传文件存储在uploads目录
5. **Token刷新**：登录状态存储在localStorage，需确保页面加载时正确读取
6. **权限控制**：所有敏感操作需验证用户角色，动态权限配置需从role_permissions表读取
7. **数据一致性**：任务状态变更需同步更新相关表，角色权限变更需同步记录日志
8. **权限变更生效**：角色权限配置变更后，用户需要重新登录才能获得新权限
9. **审批权限**：任务审核、任务分配、结果审核的操作权限仅主管理员拥有

---

## 十三、已解决的问题汇总

### 13.1 认证状态加载问题
**问题**：页面刷新后API请求返回401错误
**原因**：认证状态未从localStorage正确加载
**解决**：在组件挂载时检测token是否存在，必要时等待加载完成

### 13.2 已审核任务显示空白
**问题**：点击"已审核任务"标签页显示空白
**原因**：认证token加载时机问题
**解决**：添加token检测逻辑，确保在API调用前token已加载

### 13.3 待审核结果无法查看
**问题**：管理员在"待审核结果"界面看不到用户提交的结果
**原因**：前端通过getTasks()获取任务列表，但该API默认只返回published和claimed状态的任务
**解决**：新增getAllSubmissions() API直接获取所有提交记录

### 13.4 技术专家权限调整
**问题**：技术专家拥有审批操作权限，需要集中审批权限
**调整**：技术专家仅保留查看权限，审批操作权限统一由主管理员负责

---

**文档版本**：v1.2
**最后更新**：2026-05-25
**编写依据**：对话记录智能整理
