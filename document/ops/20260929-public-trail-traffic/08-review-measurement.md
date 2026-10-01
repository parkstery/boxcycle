# Review 07 — User traffic report

Supervisor: Codex. Accepted as a pre-deployment directional baseline, with measurement limits.

The user reports no observed issues in single and two-rider Trail rides. This supports basic ride continuity, not a quantified movement-smoothness or traffic result. The report was generated on the original live app before this branch was deployed, so it cannot validate the listing trigger or 5Hz change.

Confirmed against the Playwright spec and ISO phase logs: both runs begin riding and set speed before the 90-second `ready_quiet` interval. That interval is UI inactivity, not Firebase silence. The quoted 363 and 1,200 reads are different clock-minute slices of 60-second windows that cross minute boundaries. The 08:23–08:24 bin occurs after two-rider setup completed at 08:22:58. The 60-minute read/write ratio and listener peak include other runs. Thus the report supports increased read sensitivity in a two-client workload, but does not establish a 3.3x causal read multiplier or prove the join moment causes the peak.

Cursor's code audit maps the Trail, project-wide collection-group, listing, presence and account listeners in `07-result-measurement-review.md`. Trail live-ride and active-trail-id subscriptions already use refcount hubs. The next candidate is to measure which underlying listeners stay active while riding, particularly project-wide live-ride collection-group and world overlay subscriptions. Do not disable them without checking Trail menu and map behavior.

Measurement correction: weighting console minute bins by ride overlap only estimates traffic if events are uniform inside each bin. It cannot reconstruct exact 60-second totals. For a reliable A/B, align a longer steady riding interval to whole clock minutes after setup, repeat runs, record idle and active windows separately, and collect listener-path counters and RTDB download/write metrics. Do not treat this Firestore-only report as evidence for the 5Hz RTDB effect.

No product code changed from this report review. No deployment.
