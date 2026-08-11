// np-details.js — the Name Picker's door onto the shared per-student record.
//
// The implementation moved to `_shared/student-details.js` when a second tool
// (Behavior & Points Tracker) needed the same read of Class Roster Hub's
// `crh_students_v1` sidecar. Two copies of a name-matching rule is exactly the
// drift CLAUDE.md exists to stop: if this file's `normalize()` and Class Roster
// Hub's `normKey()` ever disagreed about what counts as the same name, students
// would silently lose their details in one tool and keep them in another.
//
// This file stays because `Tools/007-Name Picker.html` and
// `Tools/name-picker/test/smoke.mjs` import it by this path, and the shape of
// the exports is unchanged.

export {
  DETAILS_KEY, normalize, parseDetails, loadDetails, lookupDetail, displayName,
  parseIds, loadIds, lookupId,
} from '../../_shared/student-details.js';

export { default } from '../../_shared/student-details.js';
