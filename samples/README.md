# Sample logs

Made-up data for testing the parsers. No real names or telemetry in here.

| File | What it exercises |
|---|---|
| `casb-export.csv` | Has a `prompt` column, so this is the one that triggers keyword and identifier detection. Use it for demos. |
| `chrome-history.csv` | Browser export with split date/time columns. No user column, no prompts. |
| `squid-access.log` | Squid access log. No header row, fields are picked out by shape. |
| `chrome-takeout.json` | Google Takeout format with `time_usec`. Contains two hosts only the heuristics catch. |

`casb-export.csv` covers blocked-tool use, a PRC-hosted destination, keyword hits
(confidential, nda, merger, salary, source code), identifier hits (email, card,
Aadhaar, API key) and one 02:14 request that also picks up the off-hours factor.

The two browser exports have no prompt text in them, because browser history
never does. Low content findings from those is expected.
