---
title: "memmap: Inspecting Linux Process Virtual Memory Through /proc"
description: "A C-based systems tool that parses /proc maps and smaps to expose process virtual address space structure, residency, and demand-paging behavior."
date: "2026-09-05"
category: "Systems / Linux"
author: "Njoku Goodluck"
cover: "./cover.webp"
coverAlt: "Terminal output from memmap showing virtual memory mappings, RSS, and PSS for a Linux process."
---

## The question behind the tool

Most Linux users treat process memory as a single number. Tools such as `top`, `ps`, or `pmap` report RSS or VSZ, and the conversation often stops there. Underneath those numbers is a virtual address space composed of many distinct mappings, each with its own permissions, backing, and residency characteristics.

`memmap` was built to make that structure visible. It is a C utility that reads the kernel’s process interfaces directly—primarily `/proc/<PID>/maps`, `/proc/<PID>/smaps`, and `/proc/<PID>/comm`—parses them into a structured model, classifies the mappings, and presents the results as tables, summaries, or JSON.

The project deliberately stays close to the operating system. It does not wrap another command; it observes the interfaces the kernel already exposes.

## Architecture

The program is organized as a pipeline of clear responsibilities:

```text
CLI → process collection → memory model → analysis → display
```

Collection reads `/proc`. Parsing turns the text into C structures. Analysis classifies mappings and computes aggregates. Display formats the same model in multiple ways. Main orchestration stays thin and does not itself parse `/proc`.

Key source modules:

- `cli.c` / `cli.h` — argument parsing and option storage
- `proc.c` — existence checks and opening of `/proc/<PID>` files
- `maps.c` — line-oriented parsing of `/proc/<PID>/maps`
- `smaps.c` — enrichment with per-mapping statistics
- `memory.c` — dynamic array of mappings and ownership
- `analyzer.c` — classification, filtering, sorting, summary
- `display.c` — table, summary, and JSON output
- `util.c` — PID validation and helpers

The central data structures are `struct memory_mapping` (one region) and `struct memory_map` (the complete process view). Ownership is explicit: the map owns the array of mappings, every pathname string, and the process command name. `memory_map_free()` releases them.

Mappings are stored in a dynamically growing array that starts at capacity 64 and doubles on exhaustion. This is ordinary amortized growth; processes have highly variable numbers of mappings.

## Reading the kernel interfaces

### `/proc/<PID>/maps`

Each line describes a virtual memory region roughly as:

```text
start-end perms offset device inode pathname
```

The parser extracts start and end addresses, permissions, offset, device, inode, and pathname, then computes size as `end - start`. Because pathnames can be long and lines variable-length, the code uses `getline()` (with `_POSIX_C_SOURCE 200809L`) rather than a fixed buffer. The return value is correctly typed as `ssize_t` so that the end-of-file / error sentinel `-1` can be represented.

Parsing is deliberately bounded:

```c
n = sscanf(line, "%lx-%lx %4s %lx %31s %lu %4095[^\n]",
           &start, &end, perms, &offset, device, &inode, pathbuf);
```

Field widths reduce the chance of overflowing fixed buffers when converting the kernel’s text.

### `/proc/<PID>/smaps`

`smaps` supplies richer statistics per mapping: Size, Rss, Pss, Shared_Clean, Shared_Dirty, Private_Clean, Private_Dirty, Anonymous, Swap, and others. Values arrive in kilobytes and are converted to bytes for internal consistency.

`smaps` is treated as best-effort enrichment. If it is unavailable (permission, disappearance of the process, etc.), the mappings obtained from `maps` are still retained. The core purpose of the tool is the mapping layout itself; detailed residency numbers are an enhancement.

### Process command name

`/proc/<PID>/comm` supplies the short name. The trailing newline is stripped and a copy is stored under the ownership of the memory map.

## Classification, filtering, and accounting

Raw kernel text is turned into semantic categories after parsing:

- `[heap]` → heap
- `[stack` (including thread forms such as `[stack:1234]`) → stack
- `[vdso]`, `[vvar]`, `[vsyscall]` → corresponding special regions
- no pathname → anonymous
- paths containing `.so`, `ld-linux`, `ld-musl` → library
- absolute path with execute permission → executable
- other absolute paths → file-backed

Classification lives in the analyzer, not the parser. The parser answers “what did the kernel say?”; the analyzer answers “what does that mean?”

Filters (`--libraries`, `--heap`, `--stack`, `--exec`, `--write`, `--shared`, `--private`, `--anonymous`) are applied to individual mappings via a single predicate. Display never hard-codes the meaning of those categories.

Sorting uses the standard library `qsort()`. Supported keys are size, RSS, PSS (descending) and start address (ascending). The engineering value of the project is Linux memory inspection, not a custom sort implementation.

Summary analysis computes aggregates over the structured model:

- VSS — sum of mapping sizes (virtual address space)
- RSS — resident pages attributed to the mappings
- PSS — proportional share of shared pages
- anonymous vs file-backed RSS
- executable, writable, shared, and private sizes

Because the analysis operates on the in-memory model rather than re-reading `/proc`, it can be exercised with synthetic mappings in unit tests.

## Demand paging in practice

Two controlled experiments demonstrate why virtual size and resident size diverge.

Both programs create an approximately 100 MB anonymous mapping with `mmap(MAP_PRIVATE | MAP_ANONYMOUS, PROT_READ | PROT_WRITE)`.

The untouched variant never writes to the pages. Observed summary:

```text
Virtual Memory (mapped):  102.71 MB
Resident (RSS):           1.84 MB
Proportional (PSS):       155.0 KB
Anonymous (RSS):          56.0 KB
```

The touched variant writes one byte every 4096 bytes (the observed page size from `sysconf(_SC_PAGESIZE)`). Observed summary:

```text
Virtual Memory (mapped):  102.71 MB
Resident (RSS):           101.84 MB
Proportional (PSS):       100.15 MB
Anonymous (RSS):          100.05 MB
```

Virtual size is essentially identical; residency changes by nearly two orders of magnitude. Linux demand-paging establishes physical backing only when a page is first accessed. An `mmap` that is never touched therefore consumes little resident memory. Touching every page forces the page faults that populate the resident set.

Filtering to anonymous mappings on the touched process shows a single large writable anonymous region of approximately 100 MB with matching RSS—exactly the mapping created by the experiment.

An earlier attempt that used `malloc` without touching the memory produced unexpectedly small mappings. The compiler was free to eliminate an allocation whose result was never observed. Switching to an explicit `mmap` made the virtual-memory behavior deterministic and visible.

## Operational behavior

Watch mode repeatedly collects, analyzes, and displays, sleeping for a configurable interval (default 1 s). `SIGINT` and `SIGTERM` set a simple flag; the main loop exits cleanly rather than performing complex work inside the signal handler.

Processes can disappear between the existence check and the open of `maps` or `smaps`. The code treats `ENOENT` as “process exited during inspection.” Permission failures surface as `EACCES` rather than opaque errors. `/proc` is a live view of the system; races are expected.

PID validation rejects empty strings, non-numeric input, zero, negatives, overflow, and trailing characters. It uses `strtoul` rather than `atoi` so that conversion errors are detectable.

## Build and quality constraints

The normal build uses:

```text
-std=c11 -Wall -Wextra -Wpedantic -O2 -g
```

A debug configuration adds `-O0`, AddressSanitizer, and UndefinedBehaviorSanitizer. Object files live under `build/`. A clean rebuild is the expected workflow.

Several correctness issues encountered during development are worth recording because they are typical of systems code:

- Feature-test macros are required for `getline`.
- `getline` returns `ssize_t`; treating the result as `size_t` is wrong.
- Format strings must bound every conversion; a suppressed assignment (`%*`) silently drops pathnames and breaks classification.
- Partial parse success can look plausible while semantic fields are wrong. Parser tests must check every field.

## Scope and limitations

`memmap` is intentionally Linux-specific and observational. It does not ptrace, inject code, modify process memory, or attempt to replace `htop`, `pmap`, `perf`, or a debugger. Its job is to expose the structure that `/proc` already makes available.

Known limitations include incomplete JSON string escaping, heuristic library detection, sequential matching of `smaps` entries to `maps` entries, and the need for a fuller automated test suite. Future work can tighten those areas without expanding the core mission.

## What the project demonstrates

A process does not simply “have memory.” It has a virtual address space composed of mappings. Those mappings carry permissions, backing (anonymous or file), sharing semantics, and residency. Linux surfaces much of that information through a virtual filesystem. `memmap` turns the text into a structured, filterable, sortable, machine-readable model and, through controlled experiments, makes demand paging observable.

The resulting artifact is small enough to understand completely yet touches kernel interfaces, virtual memory accounting, C systems programming, and the construction of observability tools. That combination is the point of the project.