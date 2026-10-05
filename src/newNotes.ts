// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

// The notes that were created (in this run of the app) and didn't get any content yet. They are only
// in the local cache, and are not pushed to the server unless they get content: if they are left
// empty, they are thrown away again.
export const newNotes = new Set<string>();
