# EgoDepth-Bench

**Benchmarking Metric Depth for Egocentric Manipulation** · GenRobot

**[Open the code and quickstart on `main`](https://github.com/Chris004869/EgoDepth-Bench/tree/main#recreate-the-paper-tables)** · [Project page](https://egodepth-bench.github.io/) · [Paper (PDF)](https://egodepth-bench.github.io/site-assets/egodepth-bench.pdf)

[![Three egocentric manipulation scenes with camera-2 RGB and reference depth side by side.](site-assets/figures/sequence-triptych.webp)](https://egodepth-bench.github.io/#sequence-gallery)

The code on `main` includes the official scorer, 18 baseline models' evaluation adapters and the archived paper results. To reproduce the tables using only Git and Python 3.10+, run

```bash
git clone --branch main --single-branch https://github.com/Chris004869/EgoDepth-Bench.git
cd EgoDepth-Bench
python scripts/export_archived_results.py --output outputs/tables
```

[Score your predictions](https://github.com/Chris004869/EgoDepth-Bench/blob/main/docs/EVALUATION.md) · [Run a baseline](https://github.com/Chris004869/EgoDepth-Bench/blob/main/docs/MODELS.md) · [Inspect the archived results](https://github.com/Chris004869/EgoDepth-Bench/tree/main/results)
