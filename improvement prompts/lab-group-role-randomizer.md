# Improvement Prompts — Lab Group & Role Randomizer

**Tool file:** `Tools/lab-group-role-randomizer.html`
**Support folder:** none — single file

**Current description (from README):** Randomize lab groups and assign roles (recorder, materials, safety, etc.) — remembers who's had which role so nobody's stuck as Recorder every lab.

---

## Status

Reviewed — structural read of the source. Ideas below are deliberately
ambitious and are **not** scoped to a single session.

## What it does today

- Split a roster into groups (by count or size); loads `np_rosters`
- **Editable role list**; roles assigned per group with a **recency memory**
  (`roleRecencyScore`, `recordHistory`) so roles rotate fairly — the tool's
  best idea
- **Keep Apart** constraints (`resolveKeepApart`, `findApartViolations`)
- **Print table tents** (`tentsHtml`, `tentPanelHtml`) — the best physical
  output of any grouping tool on the site
- Print the group sheet and the **role history**; reset role history
- Multiple saved rosters (`lgrr_rosters` / `lgrr_current`), JSON import/export

## Quick Wins

- **Role cards with the job description on them.** A tent that says "Recorder"
  is a label; a tent that says "Recorder — write down every measurement, read
  it back to the group before moving on" is instruction. Let each role carry
  a short description that prints.
- **Lock a group or a role and reshuffle the rest.**
- **Absent handling** — reassign a missing student's role in one tap rather
  than regenerating the lab.
- **Show the fairness data.** The recency memory is the selling point and is
  currently invisible; a small "roles you've had" grid per student, printable,
  makes it credible to students who claim unfairness.
- **Group size that matches the equipment.** "I have 7 microscopes" is the
  real constraint, not "make groups of 4".
- **Undo the last shuffle** (P11).
- **Names on the tent in a size readable from the front of the room.**

## Major Features

- **Lab-specific structure.** A lab has stations, equipment, and safety
  requirements — not just groups. Assigning groups *to stations*, tracking
  which group has used which station, and printing a rotation schedule is the
  natural next layer, and `pe-tournament-stations.html` already has a rotation
  engine (P7).
- **Equipment and materials checkout.** Which group has which microscope,
  which balance, which probe — and a printable check-in sheet at the end of
  the period. This is a genuine, unserved need in a science classroom.
- **Integration with the safety contract** (P7).
  `lab-safety-contract-tracker.html` knows who has signed; this tool should
  refuse to assign an unsigned student to a lab, or at least flag it.
- **One grouping engine** (P7). This tool, `group-team-generator.html`,
  `novel-study-circles-manager.html`, and Name Picker all implement group
  formation, and two of them implement role rotation with recency memory. The
  logic should be shared.
- **Multi-day lab projects.** A lab that runs three days needs the same groups
  with rotating roles across sessions — which is exactly what
  `novel-study-circles-manager.html` does for reading circles, in a different
  tool.
- **Lab report handoff** (P7). The groups and roles should flow into a lab
  report template (already on `IDEAS_BACKLOG.md`) with the group's names
  pre-filled.

## Moonshot / North Star

**The whole lab period, organized on one sheet.** Groups formed fairly with
memory of who has worked with whom and who has done which job, assigned to
stations with the right equipment, checked against the safety contract,
printed as table tents with the role's actual instructions on them plus a
materials checkout sheet and a rotation schedule — in the two minutes before
the bell.

## Platform themes that matter here

- **P7 (cross-tool)** — the strongest case on the site for a shared grouping
  and role-rotation engine, plus real links to the safety tracker and the
  rotation timer.
- **P2 (shared roster)** — reads `np_rosters`; role history needs stable IDs
  to survive roster edits.
- **P6 (print quality)** — table tents are a specific and well-solved print
  format here worth generalizing.
- **P11 (undo)** — reshuffles are destructive.

## Open Questions

- Should this remain a separate tool from Group/Team Generator, or become a
  "lab mode" of one grouping tool? The distinctive parts (roles, stations,
  equipment, safety) are real, but the group formation is duplicated.
- Is station/equipment tracking within scope, or does it want its own tool?
