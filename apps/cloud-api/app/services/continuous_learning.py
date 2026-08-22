import math
from typing import Dict, Any
from app.models.schemas import CRMFeedbackEventRequest, CRMFeedbackEventResponse

class ContinuousLearningEngine:
    """
    RenWork 自进化反馈学习引擎 (Continuous Learning Engine)
    异步消费 CRM 回传事件，自适应微调特定品类与目标市场的切入策略权重模型
    """

    def __init__(self):
        # 默认基础权重表 (Category + Market -> Angle Weights)
        self.strategy_weights: Dict[str, Dict[str, float]] = {
            "default": {
                "second_source_resilience": 0.25,
                "backup_capacity_peak": 0.15,
                "cost_optimization": 0.20,
                "private_label_innovation": 0.10,
                "esg_sustainable_compliance": 0.15,
                "lead_time_acceleration": 0.15
            }
        }

    def process_feedback(self, event: CRMFeedbackEventRequest) -> CRMFeedbackEventResponse:
        model_key = f"{event.product_category}::{event.target_market}".lower()
        if model_key not in self.strategy_weights:
            self.strategy_weights[model_key] = dict(self.strategy_weights["default"])

        current_weights = self.strategy_weights[model_key]
        angle = event.angle_used

        # 调整步长定义
        delta = 0.0
        if event.event_type == "POSITIVE_REPLY":
            delta = +0.03
        elif event.event_type == "SAMPLE_REQUESTED":
            delta = +0.06
        elif event.event_type == "MEETING_BOOKED":
            delta = +0.09
        elif event.event_type == "DEAL_WON":
            delta = +0.15
        elif event.event_type == "LOST_PRICE_HIGH":
            delta = -0.04
            # 强化成本策略权重
            current_weights["cost_optimization"] = current_weights.get("cost_optimization", 0.20) + 0.05
        elif event.event_type == "LOST_NO_DEMAND":
            delta = -0.05

        # 应用微调并保证非负
        if angle in current_weights:
            current_weights[angle] = max(0.02, current_weights[angle] + delta)
        else:
            current_weights[angle] = max(0.02, 0.10 + delta)

        # 归一化权重表 (Sum = 1.0)
        total_weight = sum(current_weights.values())
        normalized_weights = {
            k: round(v / total_weight, 4) for k, v in current_weights.items()
        }
        self.strategy_weights[model_key] = normalized_weights

        event_id = f"FBE-{DateStr()}-{abs(hash(event.buyer_account_id)) % 100000}"

        return CRMFeedbackEventResponse(
            status="WEIGHT_MODEL_UPDATED",
            event_id=event_id,
            adjusted_weights=normalized_weights,
            message=f"Strategy weights for '{event.product_category}' in '{event.target_market}' updated successfully after '{event.event_type}'."
        )

def DateStr() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")

# 全局单例
continuous_learning_engine = ContinuousLearningEngine()
