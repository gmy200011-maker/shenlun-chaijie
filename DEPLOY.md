# 部署到公网

本项目是**全栈应用**：前端 React（构建产物 `client/dist_v2`）+ 后端 Express。
默认推荐 **Vercel（Serverless）** 部署，零信用卡、免费、自动 HTTPS。

---

## ⚠️ Vercel 的特殊性（必读）

Vercel 是**无状态 Serverless 环境**：没有常驻进程、文件系统只读。因此本项目已做如下改造：

- 后端 Express 通过 `serverless-http` 包装成云函数 `api/index.js`；`vercel.json` 已配置路由（`/api/*` → 函数，其余 → 前端）。
- 数据存储从本地 `db.json` 改为 **Upstash Redis**（云端 KV，免费、无需信用卡）。
- 未配置 Upstash 时，`server/db.js` 自动回退到本地 `fs`，方便本机 `npm run dev` 调试。

> 结论：**部署到 Vercel 必须配置 Upstash**，否则云端写入会因只读文件系统失败。

---

## 方式一：Vercel（推荐，零信用卡，免费）

### 第 1 步：准备 Upstash Redis（免费、无需信用卡）
1. 打开 [upstash.com](https://upstash.com) 注册并登录。
2. **Create Database** → 选 **Redis** → 区域选离你近的（如 `ap-southeast-1` 新加坡）→ 选 **Free** tier。
3. 建好后进入数据库详情，切到 **REST API** 标签页，复制：
   - `UPSTASH_URL`（形如 `https://xxx.upstash.io`）
   - `UPSTASH_TOKEN`（REST API 的密码 / token）

### 第 2 步：部署到 Vercel
1. 打开 [vercel.com](https://vercel.com) → 用 **GitHub** 登录。
2. **Add New → Project** → 导入本仓库 `gmy200011-maker/shenlun-chaijie`。
3. 构建配置（`vercel.json` 已写死，通常无需改）：
   - **Framework Preset**：Other
   - **Build Command**：`npm run build`
   - **Output Directory**：`client/dist_v2`
4. **关键**：展开 **Environment Variables**，添加两条：
   - `UPSTASH_URL` = 第 1 步复制的 URL
   - `UPSTASH_TOKEN` = 第 1 步复制的 token
5. 点击 **Deploy**。约 1–2 分钟后给出 `https://xxx.vercel.app` 域名。

### 第 3 步：首次使用
1. 打开 Vercel 给的域名，注册一个账号（数据写入 Upstash Redis）。
2. 进入「设置」，选择服务商（已内置 WorkBuddy / DeepSeek / 通义千问等预设）并填入你自己的 API Key。
3. 即可开始拆解文章、收藏素材 / 金句 / 解决方法、导出 Word。

---

## 方式二：Railway（单服务，最简单，需 GitHub）
> 与 Vercel 不同，Railway 是常驻进程 + 可写文件系统，沿用本地 `db.json` 即可，无需 Upstash。

1. 安装并登录 Railway CLI：
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. 在项目根目录：
   ```bash
   railway init      # 新建项目（选 Empty Project）
   railway up        # 部署，自动读取 package.json 的 build / start
   railway domain    # 生成公网域名
   ```
3. 打开域名访问。如需持久化数据，挂一个 **Volume** 指向 `/server/data`。

---

## 方式三：Render（单服务，需信用卡验证）
> Render 免费实例需绑定信用卡做验证；文件系统临时，重启会重置数据。

1. 登录 [render.com](https://render.com) → **New → Web Service** → 关联 GitHub 仓库。
2. 配置：Build `npm install && npm run build`，Start `npm start`，Node `22`（≥ 20.19）。
3. 部署后访问 `https://xxx.onrender.com`。

---

## 备注
- **Vercel** 下数据持久化依赖 Upstash Redis（已配置则稳定）；本地开发 `npm run dev` 用 `db.json`，互不影响。
- 登录态（JWT）存于 Cookie，Serverless 下每次请求独立，正常使用无碍。
- Vercel 免费额度含函数调用次数 / 时长限制，个人自用足够。
- `JWT_SECRET` 当前写死在 `server/index.js`，临时部署够用；正式上线建议改为环境变量。
