# Gemma Model Placeholder

Large Gemma web task files are intentionally not committed to Git.

To enable local Gemma inference, place the model here:

```text
public/models/gemma/gemma-4-E2B-it-web.task
```

The web demo will fall back to the local rule-based/RAG preview recommender when this file is missing or WebGPU is unavailable.
