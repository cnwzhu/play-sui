# Play Sui (基于 Sui 的预测市场)

## 项目简介

这是一个基于 **Sui 区块链** 构建的去中心化预测市场平台（类 Polymarket）。该项目演示了如何结合 Sui Move 智能合约、Rust 高性能后端服务以及现代化的 React 前端，打造一个完整的 Web3 全栈应用（dApp）。

## 技术栈架构

项目采用前后端分离架构，核心逻辑运行在链上，并通过 Rust 后端提供索引和辅助服务。

### 1. 智能合约 (Smart Contracts)
- **路径**: `contracts/polymarket`
- **语言**: [Sui Move](https://docs.sui.io/concepts/sui-move-concepts)
- **功能**: 处理核心业务逻辑，包括：
  - 预测市场的创建与生命周期管理
  - 用户投注与资金托管
  - 结果验证与奖金结算
  - 链上数据存储

### 2. 后端服务 (Backend Service)
- **路径**: `backend`
- **语言**: Rust
- **框架**: 
  - **Web 框架**: [Axum](https://github.com/tokio-rs/axum)
  - **ORM**: [SeaORM](https://www.sea-ql.org/SeaORM/) (SQLite)
  - **运行时**: Tokio
- **SDK**: `sui-sdk` (用于与 Sui 节点交互)
- **功能**:
  - 监听链上事件并索引数据
  - 提供 RESTful API 供前端查询聚合数据
  - (可选) 作为预言机 (Oracle) 服务提供外部数据源

### 3. 前端应用 (Frontend App)
- **路径**: `frontend`
- **框架**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript
- **UI 组件库**: TailwindCSS, Radix UI, Lucide React
- **Sui 集成**: [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit)
- **功能**:
  - 连接 Sui 钱包（Sui Wallet, etc.）
  - 可视化展示市场列表与详情
  - 用户下注交互界面
  - 实时数据图表展示 (Recharts)

## 快速开始 (Quick Start)

本项目使用 [`just`](https://github.com/casey/just) 作为任务运行工具，封装了常用的开发命令。

### 前置要求
- [Just](https://github.com/casey/just)
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install)
- [Rust & Cargo](https://www.rust-lang.org/tools/install)
- [Node.js (pnpm 推荐)](https://pnpm.io/installation)
- (可选) Docker (用于构建发布版)

### 常用开发命令

#### 1. 初始化与设置
```bash
# 初始化项目目录结构
just init

# 创建新的 Sui 测试网账户并自动领水
just sui-create-account
```

#### 2. 智能合约开发
```bash
# 编译 Move 合约
just build-contract

# 运行合约测试
just test-contract

# 发布合约到 Sui Testnet (会自动更新 .env 中的 PACKAGE_ID)
just publish
```

#### 3. 前端开发
```bash
# 安装前端依赖
just install-ui

# 启动前端开发服务器 (默认端口 5173)
just dev-ui
```

#### 4. 后端开发
```bash
# 运行后端服务 (会自动加载 .env 中的配置)
just dev-run

# 检查代码
just dev-check

# 构建 Docker 发布镜像
just release
```

## 项目结构

```
play-sui/
├── contracts/        # Sui Move 智能合约代码
│   └── polymarket/   # 核心预测市场合约包
├── backend/          # Rust 后端服务代码
├── frontend/         # React 前端代码
├── scripts/          # 部署与维护脚本
├── justfile          # 命令运行配置文件
├── Dockerfile        # 容器化构建文件
└── flake.nix         # Nix 开发环境配置
```

## 环境变量配置

项目根目录下的 `.env` 文件用于管理全局配置（如合约地址），后端和前端都会读取此文件。
- `VITE_PACKAGE_ID`: 已发布的智能合约 Package ID (由 `just publish` 自动维护)
- `VITE_PLATFORM_ADMIN_ADDRESS`: 平台管理员地址

---
*Generated for Play Sui Project*
