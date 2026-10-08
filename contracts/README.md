# ChainPass 合约 / Contracts

[中文](#zh) · [English](#en)

<a id="zh"></a>

## 中文

Foundry/Solidity 0.8.28/OpenZeppelin 工程。ChainPass 是不可转让 ERC-721（name=ChainPass、symbol=CPASS）；不是活动/库存/核销数据库。

### 合约规则

仅 owner（平台 issuer）调用 mintPass(address,bytes32)，拒绝零 recipient/零 hash，tokenId 从 1 递增。passHash 为数据库 PassID 的 keccak256；tokenIdByPassHash 阻止重复，PassMinted 事件支持应用恢复。非零 owner 之间 transfer 禁止，保持链/DB 归属对应。

### 测试与 ABI

从根目录：

```bash
cd contracts
forge fmt --check
forge build
forge test
```

成功构建后回到根目录同步 ABI：

```bash
cd ..
pnpm web3:sync-abi
```

同步只读取当前构建 ABI；切网络不改合约 ABI，不能把合约部署当普通 Web/API CD 一部分。

### 本地模拟

以下在 contracts 目录；Anvil 是独立终端。示例地址是 Anvil 公开开发账户，不要用作真实资产钱包：

```bash
anvil
```

```bash
export DEPLOYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url http://127.0.0.1:8545 --sender "$DEPLOYER_ADDRESS" --unlocked
```

默认仅 simulation；只有明确授权本地部署后才加--broadcast。API integration 需对应 chain/contract 与一次性 local issuer 配置，不能误指 Sepolia。

### Ethereum Sepolia

现有部署见[sepolia.json](./deployments/sepolia.json)：

- Chain ID 11155111。
- [合约](https://sepolia.etherscan.io/address/0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb)：0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb。
- Owner/deployer：0xECd97d9A3fee1a726B48fd6E2635949E40C097aC。
- [部署交易](https://sepolia.etherscan.io/tx/0xe43b47ae236313afc9052b3f47aaaf73a2b2a189aef2742d57f433136189641d)，block 11813391，Sourcify exact_match。
- Token#1 是永久 deployment smoke 测试，不是业务 Pass；[交易](https://sepolia.etherscan.io/tx/0x893322f054cd9999a7f656e57a76435a7ae5d2aa9fc0d063de6a02819a0006ee)。

不需要为文档或普通应用更新重部署。独立合约部署必须授权，先安全设置 SEPOLIA_RPC_URL 并验证 chain ID 11155111、余额与 sender，再用加密 keystore simulation：

```bash
export DEPLOYER_ADDRESS=0xECd97d9A3fee1a726B48fd6E2635949E40C097aC
cast chain-id --rpc-url "$SEPOLIA_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$SEPOLIA_RPC_URL"
forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url "$SEPOLIA_RPC_URL" --account chainpass-deployer \
  --sender "$DEPLOYER_ADDRESS"
```

仅在 simulation/test/preflight 成功且获广播授权后添加--broadcast。脚本读取公开 DEPLOYER_ADDRESS、vm.startBroadcast()，签名由 CLI account 提供；密码用 hidden prompt，不传 literal，不打印/归档 key。

contracts/.env 仅 ignored local 配置；不提交 private key、RPC credential、keystore/password、broadcast/cache/out。业务/安全细节见[技术文档](../docs/TECHNICAL_DETAILS.md#zh)。

---

<a id="en"></a>

## English

Foundry/Solidity 0.8.28/OpenZeppelin. ChainPass is a non-transferable ERC-721 (ChainPass/CPASS), not an event/inventory/admission database.

Owner-only mintPass rejects zero recipient/hash, starts token IDs at 1, and uses keccak256(databasePassID), tokenIdByPassHash and PassMinted to prevent duplicates/support recovery. Nonzero-to-nonzero transfers are disabled.

### Tests and ABI

From root:

```bash
cd contracts
forge fmt --check
forge build
forge test
```

After successful build:

```bash
cd ..
pnpm web3:sync-abi
```

ABI comes from compiled source; application CD does not redeploy Solidity.

### Local simulation

In contracts, run Anvil separately. Its public default account is disposable/local only:

```bash
anvil
```

```bash
export DEPLOYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url http://127.0.0.1:8545 --sender "$DEPLOYER_ADDRESS" --unlocked
```

No broadcast by default; add --broadcast only after deliberate local deployment authority. Configure opt-in API integration for the corresponding local chain/contract/disposable issuer, not Sepolia.

### Sepolia record and safety

[sepolia.json](./deployments/sepolia.json) records chain ID 11155111, contract 0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb, owner 0xECd97d9A3fee1a726B48fd6E2635949E40C097aC, deployment block 11813391 / Sourcify exact_match. [Contract](https://sepolia.etherscan.io/address/0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb), [deployment](https://sepolia.etherscan.io/tx/0xe43b47ae236313afc9052b3f47aaaf73a2b2a189aef2742d57f433136189641d), [smoke Token#1](https://sepolia.etherscan.io/tx/0x893322f054cd9999a7f656e57a76435a7ae5d2aa9fc0d063de6a02819a0006ee) are public evidence; #1 is not a business Pass.

No redeploy is needed for docs/ordinary app updates. Independent authorized deployment first configures RPC, verifies chain/balance/sender, then simulates with encrypted keystore:

```bash
export DEPLOYER_ADDRESS=0xECd97d9A3fee1a726B48fd6E2635949E40C097aC
cast chain-id --rpc-url "$SEPOLIA_RPC_URL"
cast balance "$DEPLOYER_ADDRESS" --rpc-url "$SEPOLIA_RPC_URL"
forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url "$SEPOLIA_RPC_URL" --account chainpass-deployer \
  --sender "$DEPLOYER_ADDRESS"
```

Only add --broadcast after tests/preflight/simulation and explicit authority. Script reads public DEPLOYER_ADDRESS and uses vm.startBroadcast; CLI account signs. Password stays hidden, never literal/logged. Never commit env/private key/RPC credential/keystore/password/broadcast/cache/out. See [internals](../docs/TECHNICAL_DETAILS.md#en).
