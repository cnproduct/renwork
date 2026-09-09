# Voiceover V29 — Personal OAuth models recover in the active organization

1. Daisy signs in to the `tianya` organization. RenWork finishes preparing the workspace and loads the organization-scoped RenWork model catalog.

2. Daisy connects her own OpenAI Plus or Pro account on this desktop. The OAuth credential remains in the device vault and is never sent to RenWork Cloud.

3. Published OpenAI OAuth models, including GPT-5.6 Luna, appear as available after the local OpenAI provider reports connected. Switching account or organization clears the previous catalog before the new organization is loaded.

4. Daisy selects GPT-5.6 Luna. The composer keeps the public `renwork` SKU selected instead of incorrectly showing “Model no longer available”.

5. When Daisy sends a task, the desktop reserves RenCredit, receives the private execution route, verifies the exact local OpenAI model, and only then rewrites the request inside the trusted host process.

6. A successful response settles the measured input, output, reasoning, and cache tokens. If OAuth is disconnected, expired, or the exact model is unavailable, the task is blocked with an actionable message and the reservation is fully released.

7. Returning to the app, opening the model picker, or pressing Retry refreshes both the organization catalog and the local provider snapshot without requiring sign-out or organization recreation.

