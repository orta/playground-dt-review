export interface DTBotJSON {
  // Jammed in via the PR query
  title: string;

  // From the PR Body
  type: string;
  now: string;
  pr_number: number;
  author: string;
  headCommitOid: string;
  lastPushDate: Date;
  lastActivityDate: Date;
  hasMergeConflict: boolean;
  isFirstContribution: boolean;
  tooManyFiles: boolean;
  popularityLevel: string;
  pkgInfo: PkgInfo[];
  reviews: any[];
  ciResult: string;
}

export interface PkgInfo {
  name: string;
  kind: string;
  files: File[];
  owners: string[];
  addedOwners: any[];
  deletedOwners: any[];
  popularityLevel: string;
}

export interface File {
  path: string;
  kind: string;
}
