# 运营后台（卡券管理 + 宠物商店）

一个零依赖的轻量级前端页面，包含两个模块：

- **卡券管理**：激励卡券的增删改查
- **宠物商店**：商店商品的增删改查（创建商品时可从卡券列表选择关联卡片）

左侧侧边栏可切换两个模块。

## 技术栈

- 前端：原生 HTML + CSS + JavaScript（无框架、无构建）
- 服务端：Node.js 内置模块（无需 `npm install`）
- 作用：
  - 托管前端静态页
  - 反向代理 `/api/*` 请求到线上接口（解决浏览器 CORS 和 Cookie 透传）

## 使用步骤

### 1. 配置线上地址和 Cookie

打开 `config.js`，填入：

- `BASE_URL`：线上接口域名，例如 `https://xxx.example.com`
- `COOKIE`：从浏览器中拷贝的登录态 Cookie 字符串
- `CA_CERT_PATH`：可选，公司内部 CA 根证书（PEM）路径
- `ALLOW_INSECURE_HTTPS`：可选，临时跳过 HTTPS 证书校验（仅开发环境）

获取 Cookie 的方法：
1. 在浏览器登录线上后台
2. 打开 DevTools → Network → 找一个已成功的请求
3. Request Headers 里复制整个 `Cookie:` 后面的字符串
4. 粘贴到 `config.js` 的 `COOKIE` 字段

### 2. 启动本地服务

```bash
cd /Users/gaomengjiao/pageview
node server.js
```

默认启动在 http://localhost:3000

### 3. 打开浏览器

访问 http://localhost:3000

- 默认进入「卡券管理」页
- 点击左侧侧边栏可切换到「宠物商店」
- 也可直接通过 hash 访问：http://localhost:3000/#cards 或 http://localhost:3000/#goods

## 主要功能

### 卡券管理

- 列表分页 + 多条件筛选（一级类型 / 二级类型 / 状态 / 名称）
- 新建、编辑、删除卡券
- 表单对 `rule_config` / `ext_config` 做 JSON 校验

### 宠物商店

- 列表分页 + 多条件筛选（商品类型 / 购买类型 / 上架状态 / 名称）
- 新建、编辑、删除商品
- **关联卡片**：商品的 `goods_value` 字段存的是卡片 ID。表单中点「选择卡片」按钮会弹出卡片选择器，自动按当前商品类型预筛选对应类型的卡券，选中后回填卡片 ID 和名称
- 表单对 `goods_condition` 做 JSON 校验

## 文件结构

```
pageview/
├── README.md       说明文档
├── config.js       后端配置（BASE_URL / Cookie / 端口）
├── server.js       Node 静态服务 + 接口代理
└── public/
    ├── index.html  页面结构（侧边栏 + 两个模块 + 弹窗）
    ├── styles.css  样式
    ├── common.js   工具函数（请求 / 提示 / 弹窗 / 转义 / JSON 校验）
    ├── cards.js    卡券管理 + 卡片选择器
    ├── goods.js    宠物商店管理
    └── app.js      入口（侧边栏路由切换）
```

## 涉及接口

### 卡券管理

- POST `/operation/api/incentive_card/create_card` 创建卡券
- POST `/operation/api/incentive_card/update_card` 更新卡券
- POST `/operation/api/incentive_card/delete_card` 删除卡券
- POST `/operation/api/incentive_card/get_card`    查询卡券详情
- POST `/operation/api/incentive_card/list_cards`  分页查询列表

### 宠物商店

- POST `/operation/api/pet_store/create_goods`           创建商品
- POST `/operation/api/pet_store/update_goods`           更新商品
- POST `/operation/api/pet_store/delete_goods`           删除商品
- POST `/operation/api/pet_store/get_goods_detail`       查询商品详情
- POST `/operation/api/pet_store/admin_get_goods_list`   管理端列表
