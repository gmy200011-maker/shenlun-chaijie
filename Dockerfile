# 申论拆解工具 — 单镜像部署（Express 后端 + React 前端）
# 构建阶段会安装依赖并把前端打包到 client/dist_v2，运行阶段由 Express 一并托管。
FROM node:22-alpine

WORKDIR /app

# 先装后端依赖（利用层缓存）
COPY package.json ./
RUN npm install --omit=dev || npm install

# 复制全部源码后在容器内构建前端（build 脚本会 cd client 安装并打包）
COPY . .

# 构建前端（package.json 的 build 脚本会 cd client 安装依赖并打包到 dist_v2）
RUN npm run build

# 数据目录（挂载持久卷到这里以保留 db.json）
RUN mkdir -p /app/server/data

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
