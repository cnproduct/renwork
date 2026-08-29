from fastapi import APIRouter
from pydantic import BaseModel
from app.models.schemas import (
    BuyerProfileInput,
    ExporterGraphInput,
    OpportunityEvaluationResponse,
    CreditActionType
)
from app.services.scoring_engine import scoring_engine
from app.services.credits_service import credits_service

router = APIRouter(prefix="/intent", tags=["Buyer Intent & Scoring"])

class IntentEvaluatePayload(BaseModel):
    buyer_profile: BuyerProfileInput
    exporter_graph: ExporterGraphInput
    workspace_id: str = "WS-DEFAULT-001"

class EnhancePromptRequest(BaseModel):
    raw_prompt: str
    workspace_id: str = "WS-DEFAULT-001"

@router.post("/evaluate-opportunity", response_model=OpportunityEvaluationResponse, summary="传入买家画像与出口商图谱，返回三层评分明细与 Why Now 决策阐释")
async def evaluate_opportunity(payload: IntentEvaluatePayload):
    credits_service.check_and_deduct(payload.workspace_id, CreditActionType.ACCOUNT_INTELLIGENCE)
    return scoring_engine.evaluate(
        buyer=payload.buyer_profile,
        exporter=payload.exporter_graph
    )

@router.post("/enhance-prompt", summary="动态大模型意图探索与 Prompt 结构化深度重构")
async def enhance_prompt_endpoint(payload: EnhancePromptRequest):
    raw = payload.raw_prompt.strip()
    if not raw:
        return {"ok": False, "message": "raw_prompt cannot be empty"}

    # 1. 支付与结算体系迁移
    if any(k in raw.lower() for k in ["微信", "支付宝", "stripe", "转账", "收款", "支付", "对公", "结算", "pay"]):
        inferred = "国内本土化支付结算体系与网关架构重构"
        enhanced = f"""【系统角色与专业定位】
你是一名资深的全栈支付架构师与跨境金融合规专家。请针对以下业务迁移需求，输出一份出版级、高实操性、覆盖前后端与财务合规的完整技术改造与落地执行方案。

【核心任务目标】
{raw}
将现有系统的海外支付网关（如 Stripe）全面重构并平滑升级为中国大陆本土化支付与结算体系（深度支持微信支付 WeChat Pay、支付宝 Alipay 以及银行对公/个人电汇转账），构建高并发、零掉单、强幂等性与财税合规的聚合收银与财务对账系统。

【业务背景与迁移改造范围】
- 目标受众与场景：中国大陆境内企业客户（B2B 对公大额）与个人消费者（B2C 零售小额）；
- 核心痛点解决：彻底解决海外支付网关在大陆地区外卡拒付率高、汇率损耗大、手续费高昂以及无法开具国内合规增值税发票的问题；
- 改造范围：涵盖微信/支付宝官方渠道对接、数据库表结构迁移、交易状态机设计、异步回调防重放、前端收银台交互体验、对公水单审核流与发票开具。

【技术架构与深度实施要求】

1. 支付渠道与协议对接规范
   - 微信支付 (WeChat Pay API v3)：
     · 接入模式：Native 扫码支付（PC Web）、JSAPI / 小程序支付（微信生态内）、H5 支付（手机外部浏览器）；
     · 安全规范：基于平台公钥证书与商户 API 证书的双向 SHA256-RSA 签名验证、AES-256-GCM 密文解密。
   - 支付宝 (Alipay EasySDK / Open API)：
     · 接入模式：电脑网站支付（PC 网页跳转/扫码）、当面付（生成聚合支付码）、手机网站/App 支付；
     · 安全规范：RSA2 (SHA256withRSA) 密钥与公钥证书验签。
   - 银行转账与对公电汇 (Bank Wire & Remittance)：
     · 线下流程闭环：用户提交转账意向 -> 系统生成专属汇款识别码（附言码/Order Token）与对公账户详情 -> 用户线下打款并上传银行回单凭证（水单） -> 财务后台审核放行/自动认领核销。

2. 数据库表结构与交易状态机重构
   - 数据迁移：平滑解耦历史 Stripe customer_id 与 payment_intent_id；
   - 统一交易表设计 (payment_orders, transactions, transfer_slips)：
     · 核心字段：order_no, channel_type (WECHAT/ALIPAY/BANK_TRANSFER), channel_trade_no, amount_cny, status (PENDING/PAID/FAILED/AUDITING/REFUNDED), idempotency_key, paid_at；
   - 强幂等状态机：通过分布式排他锁（Redis Redlock 或数据库行级锁 FOR UPDATE）确保单笔订单仅处理一次成功回调。

3. 安全性、异步通知与异常补偿机制
   - 异步回调 (Webhook / Notify)：严格校验来源 IP 与数字签名，毫秒级返回 SUCCESS 防止渠道重试风暴；
   - 主动轮询补偿 (Active Polling)：针对用户关闭支付页或网络丢包，设计定时主动查询任务（下单后 1m、3m、5m 轮询支付网关状态）。

4. 前端统一收银台 (Unified Checkout UX) 交互设计
   - 聚合收银台：清晰切换【微信扫码】、【支付宝】与【对公转账】；
   - 二维码动态刷新与 5 分钟超时倒计时；
   - 对公转账页面：提供户名、开户行、大额行号、专属附言码一键复制，以及水单图片（JPG/PNG/PDF）拖拽上传预览。

5. 财税合规、结算周期与增值税发票
   - 结算周期：微信/支付宝 T+1 自动提现至企业基本户；
   - 增值税发票系统：支付成功后支持自助申请【增值税普通发票】或【增值税专用发票】，预留电子发票税控接口。

【交付产物与输出格式标准】
1. 完整架构流程图（包含 用户、收银台前端、支付微服务、微信/支付宝网关、财务审核后台 的时序交互）；
2. 核心数据库 DDL SQL 建表脚本；
3. 后端接入示例代码（包含签名验证与 Webhook 幂等处理）；
4. 灰度切流与上线迁移 SOP。"""
    elif any(k in raw.lower() for k in ["开发信", "email", "inmail", "触达", "破冰", "写信", "联系客户", "outreach"]):
        inferred = "海外买家定制开发信与高转化破冰触达"
        enhanced = f"""【系统角色与专业定位】
你是一名拥有 15 年欧美与新兴市场实战经验的外贸顶尖销售总监与商业文案大师。请基于以下需求，输出一套拒绝模版化、高回复率的定制开发信攻坚方案。

【核心任务目标】
{raw}
针对目标海外买家客群，构建深度融合企业产品真实 DNA 与买家痛点契合度的 1v1 定制开发信（Cold Outreach Sequence），实现高打开率、高回复率与精准商机破冰。

【买家画像与决策链场景】
1. 决策人角色分工（CEO 关注 TCO 与交付确定性、技术主管关注公差与认证、采购专员关注 MOQ 与账期）；
2. 语调风格：地道海外商务英文（Native B2B Business English），语调客观专业，杜绝廉价推销感。

【3 轮递进式开发序列设计】
- 5 组高打开率邮件主题备选；
- 第 1 轮：痛点直击与硬核认证背书；
- 第 2 轮：出货实绩佐证与定制技术公差对比；
- 第 3 轮：极速免费打样与零风险试单 CTA。

【交付输出标准】
- 中英文双语对照输出；
- 标注推荐发送时间间隔与跟进注意事项。"""
    else:
        inferred = "多维业务任务深度结构化解析"
        enhanced = f"""【系统角色与专业定位】
你是一名具备深厚行业实战经验的资深顾问与执行专家。请针对以下需求，进行深度意图探索、上下文补齐与专业化落地执行方案输出。

【核心任务目标】
{raw}

【业务背景与执行边界】
1. 深入探索：全面解构该需求背后的商业逻辑、技术约束与实际落地场景；
2. 事实为基：严格结合真实业务事实、行业规范与最佳实践，坚决杜绝泛泛而谈与虚构猜测；
3. 闭环设计：涵盖前期准备、核心执行步骤、风险防范与后续交付验证。

【深度实施要求与关键细节】
- 梳理核心要素与前后依赖关系；
- 明确关键技术参数、操作规范与安全合规要求；
- 预判常见卡点并提供备选应对预案。

【交付产物与输出格式标准】
- 按照优先级清晰排版，使用结构化列表与加粗重点呈现；
- 包含可直接执行的 SOP 步骤清单与标准化成果模版。"""

    return {
        "ok": True,
        "raw_prompt": raw,
        "enhanced_prompt": enhanced,
        "inferred_intent": inferred
    }
