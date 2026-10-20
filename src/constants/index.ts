// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

export const appName = "EteSync Notes";
export const homePage = "https://www.etesync.com/";
export const faq = homePage + "faq/";
export const pricing = homePage + "pricing/";
export const sourceCode = "https://github.com/nikossvnk/etesync-notes";
export const reportIssue = sourceCode + "/issues";

export const forgotPassword = faq + "#forgot-password";

export const serviceApiBase = "https://api.etebase.com/partner/etesync/";


export const colType = "etebase.md.note";
// Bookmarks: the title is the item's name, the link and the rest are in its meta (see bookmarks.ts)
export const bookmarkColType = "etebase.bookmark";
// All of the types that are synced
export const collectionTypes = [colType, bookmarkColType];
