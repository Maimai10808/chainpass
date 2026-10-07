# ChainPass

链上数字票务与核销 Monorepo：Next.js Web、NestJS API、Expo Mobile、PostgreSQL/Prisma 与 Ethereum Sepolia。

开发前阅读 [Repository Guide](./AGENTS.md)；产品与边界见 [Product Brief](./PRODUCT_BRIEF.md) 和 [Architecture](./docs/ARCHITECTURE.md)。

## Operations

- [Deployment](./docs/DEPLOYMENT.md)：生产拓扑、CI/CD 实现、镜像与迁移、已验证状态及差异。
- [Production Operations](./docs/OPERATIONS.md)：日常发布、健康检查、排障、备份、回滚与共享服务器禁区。

默认发布路径：develop → CI → main → main CI → 人工 Deploy Production。服务器只运行提前构建的镜像；具体门槛和当前待处理事项以部署文档为准。
