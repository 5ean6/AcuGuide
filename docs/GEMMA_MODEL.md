# Gemma 模型設定 / Model Setup

大型 Gemma task 檔不提交到 Git。若要啟用本機瀏覽器推論，請將模型放在：

```text
public/models/gemma/gemma-4-E2B-it-web.task
```

模型不存在、WebGPU 不可用或載入失敗時，Demo 會自動使用本機規則式 RAG 預覽推薦。

Large Gemma task files are excluded from Git. Place the web model at the path above to enable local inference. The app falls back to its local rule-based recommender when the model or WebGPU is unavailable.
