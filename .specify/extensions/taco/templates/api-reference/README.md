# API Reference (接口与契约规范) 模板包

适用于微服务通信协议、对外开放 API、SDK 接口与事件 Payload 的技术参考文档。

## 场景定位
- **目标**：规范端点定义、请求参数、返回结果格式、状态码约定与错误结构体。
- **推荐主入口**：`overview.md`。

## 导航推荐结构
1. **API 概览 (Overview)**：鉴权方式、Base URL、统一响应封装与通用错误码。
2. **端点参考 (Endpoints)**：各具体资源端点及请求示例。
3. **数据结构定义 (Schemas)**：通用传输实体或 OpenAPI/YAML 规格。

## 包含文件
- `template.md`: API 规格通用骨架。
- `bundle.json`: 包含示例端点与数据模型定义的最小化 API bundle。
- `empty.taco.html`: 开箱即用的空白 API Taco。
