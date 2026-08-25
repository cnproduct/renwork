import re
import json

def generate_deep_enhanced_prompt(raw_prompt: str) -> str:
    raw = raw_prompt.strip()
    
    # 1. 支付与结算体系迁移类 (Payment & Settlement Migration)
    if any(k in raw.lower() for k in ["微信", "支付宝", "stripe", "转账", "收款", "支付", "对公", "结算", "pay"]):
        return f"""【系统角色与专业定位】
你是一名资深的全栈支付架构师与跨境金融合规专家。请针对以下业务迁移需求，输出一份出版级、高实操性、覆盖前后端与财务合规的完整技术改造与落地执行方案。

【核心任务目标】
将现有系统的海外支付网关（Stripe）全面替换为中国大陆本土化支付与结算体系（支持微信支付 WeChat Pay、支付宝 Alipay 以及银行对公/个人转账电汇），实现高并发、零掉单、强幂等性与财税合规的聚合收银与财务对账系统。

【业务背景与迁移改造范围】
- 目标用户群：主要为中国大陆境内企业客户（B2B）与个人消费者（B2C）；
- 核心痛点：Stripe 在国内环境面临外卡拒付率高、汇率损耗大、无法开具国内合规增值税发票等问题；
- 改造范围：涵盖支付渠道签约对接、数据库表结构迁移、交易状态机重构、异步回调防重放、前端收银台交互、财务水单审核与发票管理。

【技术架构与深度实施要求】

1. 支付渠道与协议对接规范
   - 微信支付 (WeChat Pay API v3)：
     · 接入模式：Native 扫码支付（PC 端）、JSAPI / 小程序支付（微信环境）、H5 支付（移动端外部浏览器）；
     · 安全规范：基于平台证书与商户 API 证书的 SHA256-RSA 签名验证、AES-256-GCM 回调解密。
   - 支付宝 (Alipay EasySDK / Open API)：
     · 接入模式：电脑网站支付（PC 网页跳转/扫码）、当面付（预下单生成聚合二维码）、手机网站/App 支付；
     · 安全规范：RSA2 (SHA256withRSA) 验签与公钥证书模式。
   - 银行转账与对公电汇 (Bank Wire & Remittance)：
     · 流程设计：用户提交转账意向 -> 系统生成专属汇款识别码（附言码/Order Token）与对公账户详情 -> 用户线下打款并上传银行回单凭证（水单） -> 财务后台审核放行/自动认领核销。

2. 数据库表结构与交易状态机重构
   - 数据迁移：平滑解耦 Stripe `customer_id` 与 `payment_intent_id`；
   - 统一交易主表设计 (`payment_orders`, `transactions`, `transfer_slips`)：
     · 字段包含：`order_no`, `channel_type` (WECHAT/ALIPAY/BANK_TRANSFER), `channel_trade_no`, `amount_cny`, `status` (PENDING/PAID/FAILED/AUDITING/REFUNDED), `idempotency_key`, `paid_at`；
   - 幂等状态机：严格通过分布式排他锁（Redis Redlock 或数据库行锁 `FOR UPDATE`）确保单笔订单仅处理一次成功回调。

3. 安全性、异步通知与异常补偿机制
   - 异步回调 (Webhook / Notify)：
     · 校验通知来源 IP 与官方签名；
     · 毫秒级异步应答 `SUCCESS`，防止渠道重复重试；
   - 主动轮询补偿 (Active Polling & Query)：
     · 针对用户关闭支付页或网络丢包，设计定时主动查询任务（下单后 1m、3m、5m 轮询支付网关）。

4. 前端统一收银台 (Unified Checkout UX) 交互设计
   - 聚合收银台界面：一键切换【微信扫码】、【支付宝】与【对公转账】；
   - 二维码动态刷新与过期倒计时（5分钟自动失效并提示刷新）；
   - 对公转账页面：清晰展示开户行、户名、大额行号、专属附言码，提供一键复制与水单图片（JPG/PNG/PDF）拖拽上传预览。

5. 财税合规、结算周期与增值税发票
   - 结算周期对齐：微信/支付宝 T+1 自动结算至企业基本户；
   - 增值税发票模块：用户支付成功后可自助申请开具【增值税电子普通发票】或【增值税专用发票】，对接百望云/航天信息等电子发票税控接口。

【交付产物与输出格式标准】
1. 完整架构流程图（包含 用户、收银台前端、支付微服务、微信/支付宝网关、财务审核后台 的时序交互）；
2. 核心数据库 DDL SQL 脚本；
3. 后端核心接入示例代码（含签名验证与 Webhook 幂等处理）；
4. 迁移实施步骤与回滚预案（灰度切流 SOP）。"""
    
    return raw

print(generate_deep_enhanced_prompt("我们主要是中国大陆用户，应该用微信，支付宝或者银行转账来替换stripe收款，请优化")[:600])
