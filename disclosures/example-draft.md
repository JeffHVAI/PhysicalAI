---
title: "A new system for hovering"
lead_inventor: "Jeff"
project_context: "Hover OS"
status: "Draft"
---

## 1. The Bottleneck (Problem)
The hover engine was running slow when processing multiple altitude coordinates at the same time. The drone would wobble because of latency.

## 2. The Breakthrough (Solution)
We optimized the update loop. Instead of computing sequentially, we just execute the loop in parallel using threads.

## 3. The Evidence (Data/Implementation)
See the code in the drone-core directory.

## 4. Why It’s Unique (Non-Obviousness)
It runs much faster than before. No other standard library was replaced, we just wrote it ourselves. There are no other ways to do this.
