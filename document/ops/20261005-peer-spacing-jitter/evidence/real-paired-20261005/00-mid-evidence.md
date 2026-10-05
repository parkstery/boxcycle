# Mid evidence — real paired JSON (task 34)

- Copied Downloads JSON → evidence/real-paired-20261005/{rider_A,rider_B}.json (no secrets; UIDs kept local-only in ops).
- capture meta both idle; frames/ingest = legacy ring 240 (not full capture(20) payload). Finish→ring overwrite bug confirmed by idle+240.
- Running overlap ~14s; gap A≈-0.27m B≈+0.28m (sum≈0, order sync OK).
- Running 1s gap pp ≈0.05–0.17m; dGap zero-cross period median ≈250–300ms (≈RTDB publish).
- Both peer+self move every frame (not hold/catchup stair). Wire dist always *.0 (0.1m grid).
- Dual quantized lerp sim → gap pp 0.10m/s — matches observed sub-meter periodic jitter.
- Display-correction asymmetry does NOT explain steady beat (sim unchanged).
- Next: narrow quantize/fix + lastCompletedCapture persistence + behavior tests.
