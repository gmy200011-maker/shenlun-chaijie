# 部署到公网

本项目是**单服务全栈应用**：前端 React 构建产物 + 后端 Express，由同一个 Node 进程托管。
已做生产化改造，可直接丢到任意能跑 Node 的云平台：

- 端口读取 `process.env.PORT`（默认 3001），兼容云平台随机端口。
- 单一启动命令 `node server/index.js`，同时托管前端静态页与 `/api`。
- 前端 API 使用相对路径 `/api`，**无需配置跨域 / 反向代理**。
- 每个用户在网页「设置」里填写自己的 AI 接口密钥，服务端不存任何密钥。

---

## 前置条件
1. 代码已 `git init` 并提交（本目录已完成）。
2. 把仓库推到 GitHub / GitLab / 码云等（部署平台从这里拉代码）。
3. 注册一个云平台账号（Railway 或 Render，都有免费额度）。

---

## 方式一：Railway（推荐，最简单，无需 GitHub）
1. 安装并登录 Railway CLI：
   ```bash
   npm i -g @railway/cli
   railway login
   ```
2. 在项目根目录执行：
   ```bash
   railway init      # 新建项目（按提示选 Empty Project）
   railway up        # 部署，会自动读取 package.json 的 build / start
   railway domain    # 生成一个公网访问域名
   ```
3. 打开 Railway 给出的域名即可访问。

> 想持久化数据，可在 Railway 项目里挂一个 **Volume** 并指向 `/server/data`，否则免费实例重启会重置数据。

---

## 方式二：Render（通过 GitHub）
1. 把本仓库推到 GitHub：
   ```bash
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```
2. 登录 [render.com](https://render.com) → **New → Web Service** → 关联 GitHub 仓库。
3. 配置：
   - **Build Command**：`npm install && npm run build`
   - **Start Command**：`npm start`
   - **Node Version**：`22`（或 ≥ 20.19）
4. 部署完成后 Render 给出 `https://xxx.onrender.com`，直接访问。

> Render 免费实例的文件系统是临时的，每次重新部署会重置 `server/data/db.json`，个人自用通常可接受。

---

## 部署后首次使用
1. 打开公网域名，注册一个账号。
2. 进入「设置」，选择服务商（已内置 WorkBuddy / DeepSeek / 通义千问等预设）并填入你自己的 API Key。
3. 即可开始拆解文章、收藏素材 / 金句 / 解决方法、导出 Word。

---

## 备注
- 免费实例文件系统临时，数据与注册账号会随重新部署清空。如需稳定持久化：Railway 挂 Volume，或把 `server/db.js` 换成 SQLite / Postgres。
- `JWT_SECRET` 当前写死在 `server/index.js`，临时部署够用；正式上线建议改为环境变量。
